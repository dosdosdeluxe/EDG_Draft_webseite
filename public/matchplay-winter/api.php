<?php
/* ==========================================================================
   Winter Matchplay Serie: Speicher-Schnittstelle für den Editor (editor.html)

   EINMALIG EINRICHTEN: Trage bei $USERS die Namen und Startpasswörter der
   Personen ein, die Ergebnisse eintragen dürfen. Das Passwort muss geändert
   werden, sonst lässt sich nicht speichern. Jede Person kann ihr Passwort
   danach im Editor selbst ändern (Reiter „Verlauf und Konto"). Das neue
   Passwort wird verschlüsselt in der Datei users.php gespeichert und ersetzt
   dann das Startpasswort.
   ========================================================================== */

$USERS = [
    'Niki' => 'BITTE-AENDERN',
    'HP'   => 'BITTE-AENDERN',
    'BO'   => 'BITTE-AENDERN',
    // weitere Personen: 'Name' => 'Passwort',
];

/* Optional: E-Mail-Adresse, an die jede neue Ergebnis-Meldung geschickt wird.
   Leer lassen, wenn keine Mail gewünscht ist. */
$MELDUNG_MAIL = '';

/* ---------- ab hier nichts ändern ---------- */
date_default_timezone_set('Europe/Berlin');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$DIR        = __DIR__;
$DATA_FILE  = $DIR . '/data.json';
$BAK_FILE   = $DIR . '/data.bak.json';
$HIST_FILE  = $DIR . '/verlauf.php';   /* Änderungsprotokoll (nicht abrufbar) */
$USERS_FILE = $DIR . '/users.php';     /* geänderte Passwörter (verschlüsselt) */
$MELD_FILE  = $DIR . '/meldungen.php'; /* eingegangene Ergebnis-Meldungen */
$HIST_MAX   = 40;
$TSP_FILE    = $DIR . '/terminspieler.php'; /* von Spielern eingetragene Spieltermine */

function fail($code, $msg) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

function pass_ok($stored, $given) {
    if (!is_string($stored) || !is_string($given) || $given === '') return false;
    if (strpos($stored, '$2y$') === 0) return password_verify($given, $stored);
    return hash_equals($stored, $given);
}

function clean_str($v, $max) {
    if (!is_string($v)) return '';
    $v = strip_tags($v);
    $v = preg_replace('/[\x00-\x1F\x7F]/u', '', $v);
    $v = trim($v);
    return mb_substr($v, 0, $max);
}

function atomic_write($file, $content) {
    $tmp = $file . '.tmp';
    if (@file_put_contents($tmp, $content, LOCK_EX) === false) return false;
    if (!@rename($tmp, $file)) { @unlink($tmp); return false; }
    return true;
}

/* Dateien mit PHP-Kopfzeile: der Server führt sie nur aus (zeigt nichts an) */
function guarded_read($file) {
    if (!is_file($file)) return null;
    $raw = (string)@file_get_contents($file);
    $pos = strpos($raw, "\n");
    if ($pos === false) return null;
    $d = json_decode(substr($raw, $pos + 1), true);
    return is_array($d) ? $d : null;
}
function guarded_write($file, $data) {
    return atomic_write($file, "<?php exit; ?>\n" . json_encode($data, JSON_UNESCAPED_UNICODE));
}

$IDS = ['A1','A2','A3','A4','A5','A6','B1','B2','B3','B4','B5','B6'];
$TERMIN_KEYS = ['1','2','3','4','5','finale'];

$OVERRIDES = guarded_read($USERS_FILE) ?: [];
$ALLUSERS = $USERS;
foreach ($OVERRIDES as $n => $h) {
    if (array_key_exists($n, $USERS) && is_string($h)) $ALLUSERS[$n] = $h;
}

/* Wird von foto.php eingebunden: nur Hilfsfunktionen und Benutzer laden */
if (defined('MATCHPLAY_LIB')) return;

/* Benutzerliste für die Anmeldemaske */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (($_GET['action'] ?? '') === 'users') {
        echo json_encode(['users' => array_keys($ALLUSERS)], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if (($_GET['action'] ?? '') === 'termine') {
        $l = guarded_read($TSP_FILE) ?: [];
        $out = [];
        foreach ($l as $e) $out[] = ['a' => $e['a'], 'b' => $e['b'], 'datum' => $e['datum'], 'zeit' => $e['zeit'] ?? '', 'von' => $e['von'] ?? '', 't' => $e['t'] ?? ''];
        echo json_encode(['ok' => true, 'termine' => $out], JSON_UNESCAPED_UNICODE);
        exit;
    }
    fail(400, 'Unbekannte Anfrage.');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'Nicht erlaubt.');

$raw = file_get_contents('php://input', false, null, 0, 200001);
if ($raw === false || strlen($raw) > 200000) fail(413, 'Daten zu groß.');
$req = json_decode($raw, true);
if (!is_array($req)) fail(400, 'Ungültige Anfrage.');

$user = (string)($req['user'] ?? '');
$pass = $req['pass'] ?? '';
$action = (string)($req['action'] ?? '');

/* ---------- Ergebnis melden (öffentlich, ohne Anmeldung) ---------- */
if ($action === 'melden') {
    $LOCKM = @fopen($DIR . '/sperre.lock', 'c');
    if ($LOCKM) @flock($LOCKM, LOCK_EX);

    if (!empty($req['website'])) { echo json_encode(['ok' => true]); exit; } /* Spam-Falle */
    $a = (string)($req['a'] ?? ''); $b = (string)($req['b'] ?? '');
    if (!in_array($a, $IDS, true) || !in_array($b, $IDS, true) || $a === $b || $a[0] !== $b[0]) fail(400, 'Dieses Spiel gibt es nicht.');
    $typ = ((string)($req['typ'] ?? '') === 'termin') ? 'termin' : 'ergebnis';
    $datum = ''; $zeit = '';
    if ($typ === 'termin') {
        $datum = valid_datum($req['datum'] ?? ''); if ($datum === '') fail(400, 'Bitte ein gültiges Datum eintragen.');
        $zeit = valid_zeit($req['zeit'] ?? '');
        $ga = 0; $gb = 0;
    } else {
        $ga = $req['ga'] ?? null; $gb = $req['gb'] ?? null;
        if (!is_int($ga) && !(is_string($ga) && ctype_digit($ga))) fail(400, 'Bitte beide Ergebnisse als Zahlen eintragen.');
        if (!is_int($gb) && !(is_string($gb) && ctype_digit($gb))) fail(400, 'Bitte beide Ergebnisse als Zahlen eintragen.');
        $ga = (int)$ga; $gb = (int)$gb;
        if ($ga < 0 || $ga > 99 || $gb < 0 || $gb > 99) fail(400, 'Die Zahlen müssen zwischen 0 und 99 liegen.');
    }
    $von = clean_str($req['von'] ?? '', 40);
    if ($von === '') fail(400, 'Bitte deinen Namen eintragen.');
    $notiz = clean_str($req['notiz'] ?? '', 200);

    $ipHash = substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|matchplay'), 0, 16);
    $list = guarded_read($MELD_FILE) ?: [];
    $recent = 0; $now = time();
    foreach ($list as $e) {
        if (($e['ip'] ?? '') === $ipHash && $now - (int)($e['ts'] ?? 0) < 3600) $recent++;
        if (($e['typ'] ?? 'ergebnis') === $typ && ($e['datum'] ?? '') === $datum && ($e['zeit'] ?? '') === $zeit && ($e['a'] ?? '') === $a && ($e['b'] ?? '') === $b && ($e['ga'] ?? -1) === $ga && ($e['gb'] ?? -1) === $gb && ($e['von'] ?? '') === $von) {
            echo json_encode(['ok' => true]); exit; /* schon gemeldet */
        }
    }
    if ($recent >= 8) fail(429, 'Zu viele Meldungen in kurzer Zeit. Bitte später noch einmal versuchen.');
    if (count($list) >= 150) fail(503, 'Das Postfach der Turnierleitung ist voll. Bitte direkt bei der Turnierleitung melden.');

    $id = 1;
    foreach ($list as $e) { if (($e['id'] ?? 0) >= $id) $id = $e['id'] + 1; }
    $list[] = ['id' => $id, 't' => date('c'), 'ts' => $now, 'ip' => $ipHash, 'a' => $a, 'b' => $b, 'ga' => $ga, 'gb' => $gb, 'typ' => $typ, 'datum' => $datum, 'zeit' => $zeit, 'von' => $von, 'notiz' => $notiz];
    if (!guarded_write($MELD_FILE, $list)) fail(500, 'Die Meldung konnte nicht gespeichert werden. Bitte direkt bei der Turnierleitung melden.');
    if ($MELDUNG_MAIL !== '') {
        @mail($MELDUNG_MAIL, 'Matchplay: neue Ergebnis-Meldung', "Von: $von
Spiel: $a gegen $b
Ergebnis/Termin: " . ($typ === 'termin' ? "$datum $zeit" : "$ga:$gb") . "
Hinweis: $notiz

Im Editor unter Meldungen prüfen und übernehmen.", "Content-Type: text/plain; charset=utf-8");
    }
    echo json_encode(['ok' => true]);
    exit;
}

/* ---------- Spieltermin eintragen (öffentlich, die Teams stimmen sich selbst ab) ---------- */
if ($action === 'termin_setzen') {
    $LOCKT = @fopen($DIR . '/sperre.lock', 'c');
    if ($LOCKT) @flock($LOCKT, LOCK_EX);
    if (!empty($req['website'])) { echo json_encode(['ok' => true]); exit; }
    $a = (string)($req['a'] ?? ''); $b = (string)($req['b'] ?? '');
    if (!in_array($a, $IDS, true) || !in_array($b, $IDS, true) || $a === $b || $a[0] !== $b[0]) fail(400, 'Dieses Spiel gibt es nicht.');
    $datum = valid_datum($req['datum'] ?? ''); if ($datum === '') fail(400, 'Bitte ein gültiges Datum eintragen.');
    $zeit = valid_zeit($req['zeit'] ?? '');
    $von = clean_str($req['von'] ?? '', 40); if ($von === '') fail(400, 'Bitte deinen Namen eintragen.');
    $ipHash = substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|matchplay'), 0, 16);
    $list = guarded_read($TSP_FILE) ?: [];
    $now = time(); $recent = 0;
    foreach ($list as $e) { if (($e['ip'] ?? '') === $ipHash && $now - (int)($e['ts'] ?? 0) < 3600) $recent++; }
    if ($recent >= 20) fail(429, 'Zu viele Änderungen in kurzer Zeit. Bitte später noch einmal versuchen.');
    $p = [$a, $b]; sort($p); $key = implode('-', $p);
    $list[$key] = ['a' => $a, 'b' => $b, 'datum' => $datum, 'zeit' => $zeit, 'von' => $von, 't' => date('c'), 'ts' => $now, 'ip' => $ipHash];
    if (!guarded_write($TSP_FILE, $list)) fail(500, 'Der Termin konnte nicht gespeichert werden. Bitte bei der Turnierleitung melden.');
    echo json_encode(['ok' => true, 'termin' => ['a' => $a, 'b' => $b, 'datum' => $datum, 'zeit' => $zeit, 'von' => $von, 't' => $list[$key]['t']]], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!array_key_exists($user, $ALLUSERS)) { usleep(800000); fail(401, 'Name oder Passwort stimmt nicht.'); }
if (strpos($ALLUSERS[$user], 'BITTE-AENDERN') === 0) {
    fail(403, 'Einrichtung fehlt: Bitte zuerst in der Datei api.php ein eigenes Passwort eintragen.');
}
if (!pass_ok($ALLUSERS[$user], $pass)) { usleep(800000); fail(401, 'Name oder Passwort stimmt nicht.'); }

if ($action === 'login') {
    echo json_encode(['ok' => true]);
    exit;
}

/* Schreibzugriffe nacheinander abarbeiten */
$LOCK = @fopen($DIR . '/sperre.lock', 'c');
if ($LOCK) @flock($LOCK, LOCK_EX);

function read_current($DATA_FILE) {
    $current = ['rev' => 0];
    if (is_file($DATA_FILE)) {
        $c = json_decode((string)file_get_contents($DATA_FILE), true);
        if (is_array($c)) $current = $c;
    }
    return $current;
}

function valid_datum($v) {
    if (!is_string($v) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $v, $m)) return '';
    return (checkdate((int)$m[2], (int)$m[3], (int)$m[1]) && (int)$m[1] >= 2026 && (int)$m[1] <= 2028) ? $v : '';
}
function valid_zeit($v) {
    return (is_string($v) && preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $v)) ? $v : '';
}

/* Daten prüfen und bereinigen */
function sanitize($in, $rev, $user, $IDS, $TERMIN_KEYS) {
    $clean = ['version' => 1, 'rev' => $rev, 'teams' => [], 'termine' => [], 'kontakt' => '', 'ergebnisse' => [], 'finalspiele' => [], 'spieltermine' => []];
    foreach ($IDS as $id) {
        $t = $in['teams'][$id] ?? [];
        $clean['teams'][$id] = [
            'name' => clean_str($t['name'] ?? '', 40),
            's1'   => clean_str($t['s1'] ?? '', 40),
            's2'   => clean_str($t['s2'] ?? '', 40),
        ];
    }
    foreach ($TERMIN_KEYS as $k) {
        $clean['termine'][$k] = clean_str($in['termine'][$k] ?? '', 40);
    }
    $clean['kontakt'] = clean_str($in['kontakt'] ?? '', 120);

    $seen = [];
    $list = is_array($in['ergebnisse'] ?? null) ? $in['ergebnisse'] : [];
    foreach ($list as $r) {
        if (!is_array($r)) continue;
        $a = (string)($r['a'] ?? ''); $b = (string)($r['b'] ?? '');
        if (!in_array($a, $IDS, true) || !in_array($b, $IDS, true) || $a === $b) continue;
        if ($a[0] !== $b[0]) continue;
        $ga = $r['ga'] ?? null; $gb = $r['gb'] ?? null;
        if (!is_int($ga) && !(is_string($ga) && ctype_digit($ga))) continue;
        if (!is_int($gb) && !(is_string($gb) && ctype_digit($gb))) continue;
        $ga = (int)$ga; $gb = (int)$gb;
        if ($ga < 0 || $ga > 99 || $gb < 0 || $gb > 99) continue;
        $pair = [$a, $b]; sort($pair);
        $seen[implode('-', $pair)] = ['a' => $a, 'b' => $b, 'ga' => $ga, 'gb' => $gb];
    }
    $clean['ergebnisse'] = array_values($seen);

    $st = [];
    $sl = is_array($in['spieltermine'] ?? null) ? $in['spieltermine'] : [];
    foreach ($sl as $r) {
        if (!is_array($r)) continue;
        $a = (string)($r['a'] ?? ''); $b = (string)($r['b'] ?? '');
        if (!in_array($a, $IDS, true) || !in_array($b, $IDS, true) || $a === $b || $a[0] !== $b[0]) continue;
        $dat = valid_datum($r['datum'] ?? ''); if ($dat === '') continue;
        $pair = [$a, $b]; sort($pair);
        $st[implode('-', $pair)] = ['a' => $a, 'b' => $b, 'datum' => $dat, 'zeit' => valid_zeit($r['zeit'] ?? '')];
    }
    $clean['spieltermine'] = array_values($st);

    $fin = [];
    $fl = is_array($in['finalspiele'] ?? null) ? $in['finalspiele'] : [];
    foreach ($fl as $r) {
        if (!is_array($r)) continue;
        $k = $r['k'] ?? null;
        if (!is_int($k) && !(is_string($k) && ctype_digit($k))) continue;
        $k = (int)$k; if ($k < 1 || $k > 6) continue;
        $ga = $r['ga'] ?? null; $gb = $r['gb'] ?? null;
        if (!is_int($ga) && !(is_string($ga) && ctype_digit($ga))) continue;
        if (!is_int($gb) && !(is_string($gb) && ctype_digit($gb))) continue;
        $ga = (int)$ga; $gb = (int)$gb;
        if ($ga < 0 || $ga > 99 || $gb < 0 || $gb > 99) continue;
        $fin[$k] = ['k' => $k, 'ga' => $ga, 'gb' => $gb];
    }
    ksort($fin);
    $clean['finalspiele'] = array_values($fin);
    $clean['geaendert'] = ['von' => $user, 'am' => date('c')];
    return $clean;
}

/* Verständliche Liste: was hat sich geändert? */
function describe_changes($old, $new, $IDS, $TERMIN_KEYS) {
    $out = [];
    $nm = function ($d, $id) {
        $n = trim((string)($d['teams'][$id]['name'] ?? ''));
        return $n !== '' ? $n : "Team $id";
    };
    $labels = ['name' => 'Teamname', 's1' => 'Spieler 1', 's2' => 'Spieler 2'];
    foreach ($IDS as $id) {
        $o = $old['teams'][$id] ?? [];
        foreach ($labels as $f => $lab) {
            $ov = (string)($o[$f] ?? ''); $nv = (string)$new['teams'][$id][$f];
            if ($ov !== $nv) $out[] = "$id $lab: " . ($ov === '' ? '(leer)' : $ov) . ' → ' . ($nv === '' ? '(leer)' : $nv);
        }
    }
    foreach ($TERMIN_KEYS as $k) {
        $ov = (string)($old['termine'][$k] ?? ''); $nv = (string)$new['termine'][$k];
        if ($ov !== $nv) {
            $lab = $k === 'finale' ? 'Termin Finaltag' : "Termin Spieltag $k";
            $out[] = "$lab: " . ($ov === '' ? '(leer)' : $ov) . ' → ' . ($nv === '' ? '(leer)' : $nv);
        }
    }
    if ((string)($old['kontakt'] ?? '') !== (string)$new['kontakt']) $out[] = 'Kontakt für Ergebnisse geändert';

    $oldmap = [];
    foreach (($old['ergebnisse'] ?? []) as $r) {
        $p = [$r['a'], $r['b']]; sort($p);
        $oldmap[implode('-', $p)] = $r;
    }
    $newkeys = [];
    foreach ($new['ergebnisse'] as $r) {
        $p = [$r['a'], $r['b']]; sort($p);
        $key = implode('-', $p); $newkeys[$key] = true;
        $title = $nm($new, $r['a']) . ' – ' . $nm($new, $r['b']);
        if (!isset($oldmap[$key])) { $out[] = "Ergebnis $title: {$r['ga']}:{$r['gb']} eingetragen"; continue; }
        $o = $oldmap[$key];
        $oga = $o['a'] === $r['a'] ? $o['ga'] : $o['gb'];
        $ogb = $o['a'] === $r['a'] ? $o['gb'] : $o['ga'];
        if ((int)$oga !== $r['ga'] || (int)$ogb !== $r['gb']) $out[] = "Ergebnis $title: $oga:$ogb → {$r['ga']}:{$r['gb']}";
    }
    foreach ($oldmap as $key => $o) {
        if (!isset($newkeys[$key])) $out[] = 'Ergebnis ' . $nm($old, $o['a']) . ' – ' . $nm($old, $o['b']) . ': gelöscht';
    }
    $om = []; foreach (($old['spieltermine'] ?? []) as $r) { $p = [$r['a'], $r['b']]; sort($p); $om[implode('-', $p)] = $r; }
    $nmp = [];
    foreach ($new['spieltermine'] as $r) {
        $p = [$r['a'], $r['b']]; sort($p); $key = implode('-', $p); $nmp[$key] = true;
        $title = $nm($new, $r['a']) . ' – ' . $nm($new, $r['b']);
        $nv = $r['datum'] . ($r['zeit'] !== '' ? ' ' . $r['zeit'] : '');
        if (!isset($om[$key])) { $out[] = "Spieltermin $title: $nv eingetragen"; continue; }
        $ov = $om[$key]['datum'] . (($om[$key]['zeit'] ?? '') !== '' ? ' ' . $om[$key]['zeit'] : '');
        if ($ov !== $nv) $out[] = "Spieltermin $title: $ov → $nv";
    }
    foreach ($om as $key => $o) { if (!isset($nmp[$key])) $out[] = 'Spieltermin ' . $nm($old, $o['a']) . ' – ' . $nm($old, $o['b']) . ': gelöscht'; }
    $of = []; foreach (($old['finalspiele'] ?? []) as $r) { $of[(int)$r['k']] = $r; }
    $nf = []; foreach ($new['finalspiele'] as $r) { $nf[(int)$r['k']] = $r; }
    $flab = [1 => 'Finale', 2 => 'Spiel um Platz 3', 3 => 'Spiel um Platz 5', 4 => 'Spiel um Platz 7', 5 => 'Spiel um Platz 9', 6 => 'Spiel um Platz 11'];
    for ($k = 1; $k <= 6; $k++) {
        $o = $of[$k] ?? null; $n = $nf[$k] ?? null;
        if ($n && !$o) $out[] = "Finaltag $flab[$k]: {$n['ga']}:{$n['gb']} eingetragen";
        elseif ($n && $o && ((int)$o['ga'] !== $n['ga'] || (int)$o['gb'] !== $n['gb'])) $out[] = "Finaltag $flab[$k]: {$o['ga']}:{$o['gb']} → {$n['ga']}:{$n['gb']}";
        elseif (!$n && $o) $out[] = "Finaltag $flab[$k]: Ergebnis gelöscht";
    }
    if (count($out) > 40) { $rest = count($out) - 40; $out = array_slice($out, 0, 40); $out[] = "… und $rest weitere Änderungen"; }
    return $out;
}

function add_history($HIST_FILE, $HIST_MAX, $user, $kind, $changes, $before) {
    $h = guarded_read($HIST_FILE) ?: [];
    $id = 1;
    foreach ($h as $e) { if (isset($e['id']) && $e['id'] >= $id) $id = $e['id'] + 1; }
    unset($before['geaendert']);
    $h[] = ['id' => $id, 't' => date('c'), 'user' => $user, 'kind' => $kind, 'changes' => $changes, 'before' => $before];
    if (count($h) > $HIST_MAX) $h = array_slice($h, -$HIST_MAX);
    @guarded_write($HIST_FILE, $h);
}

function write_data($DATA_FILE, $BAK_FILE, $clean) {
    $json = json_encode($clean, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($json === false) fail(500, 'Daten konnten nicht verarbeitet werden.');
    if (is_file($DATA_FILE)) @copy($DATA_FILE, $BAK_FILE);
    if (!atomic_write($DATA_FILE, $json)) {
        fail(500, 'Speichern nicht möglich. Bitte im IONOS Webspace Explorer bei data.json die Zugriffsrechte auf 664 setzen (nicht 777).');
    }
}

/* ---------- Von Spielern eingetragenen Termin entfernen ---------- */
if ($action === 'termin_loeschen') {
    $a = (string)($req['a'] ?? ''); $b = (string)($req['b'] ?? '');
    $p = [$a, $b]; sort($p); $key = implode('-', $p);
    $list = guarded_read($TSP_FILE) ?: [];
    unset($list[$key]);
    if (!guarded_write($TSP_FILE, $list)) fail(500, 'Konnte nicht entfernt werden.');
    echo json_encode(['ok' => true]);
    exit;
}

/* ---------- Verlauf anzeigen ---------- */
if ($action === 'history') {
    $h = guarded_read($HIST_FILE) ?: [];
    $list = [];
    foreach (array_reverse($h) as $e) {
        $list[] = ['id' => $e['id'] ?? 0, 't' => $e['t'] ?? '', 'user' => $e['user'] ?? '', 'kind' => $e['kind'] ?? 'save', 'changes' => $e['changes'] ?? []];
    }
    echo json_encode(['ok' => true, 'history' => $list], JSON_UNESCAPED_UNICODE);
    exit;
}

/* ---------- Eingegangene Meldungen ---------- */
if ($action === 'meldungen') {
    $list = guarded_read($MELD_FILE) ?: [];
    $out = [];
    foreach ($list as $e) {
        $out[] = ['id' => $e['id'] ?? 0, 't' => $e['t'] ?? '', 'a' => $e['a'] ?? '', 'b' => $e['b'] ?? '', 'ga' => $e['ga'] ?? 0, 'gb' => $e['gb'] ?? 0, 'typ' => $e['typ'] ?? 'ergebnis', 'datum' => $e['datum'] ?? '', 'zeit' => $e['zeit'] ?? '', 'von' => $e['von'] ?? '', 'notiz' => $e['notiz'] ?? ''];
    }
    echo json_encode(['ok' => true, 'meldungen' => $out], JSON_UNESCAPED_UNICODE);
    exit;
}
if ($action === 'meldung_erledigt') {
    $ids = is_array($req['ids'] ?? null) ? array_map('intval', $req['ids']) : [];
    $list = guarded_read($MELD_FILE) ?: [];
    $rest = [];
    foreach ($list as $e) { if (!in_array((int)($e['id'] ?? 0), $ids, true)) $rest[] = $e; }
    if (!guarded_write($MELD_FILE, $rest)) fail(500, 'Die Meldung konnte nicht entfernt werden.');
    echo json_encode(['ok' => true, 'rest' => count($rest)]);
    exit;
}

/* ---------- Passwort ändern ---------- */
if ($action === 'passwd') {
    $new = $req['newpass'] ?? '';
    if (!is_string($new) || mb_strlen($new) < 8) fail(400, 'Das neue Passwort braucht mindestens 8 Zeichen.');
    if (mb_strlen($new) > 100) fail(400, 'Das neue Passwort ist zu lang (höchstens 100 Zeichen).');
    if (strpos($new, 'BITTE-AENDERN') === 0) fail(400, 'Dieses Passwort ist nicht erlaubt.');
    $OVERRIDES[$user] = password_hash($new, PASSWORD_DEFAULT);
    if (!guarded_write($USERS_FILE, $OVERRIDES)) {
        fail(500, 'Passwort konnte nicht gespeichert werden. Der Ordner auf dem Webspace muss beschreibbar sein.');
    }
    echo json_encode(['ok' => true]);
    exit;
}

/* ---------- Version wiederherstellen ---------- */
if ($action === 'restore') {
    $current = read_current($DATA_FILE);
    $curRev = (int)($current['rev'] ?? 0);
    if ((int)($req['rev'] ?? 0) !== $curRev) {
        fail(409, 'Jemand anderes hat in der Zwischenzeit gespeichert. Bitte die Seite neu laden.');
    }
    $want = (int)($req['id'] ?? 0);
    $found = null;
    foreach ((guarded_read($HIST_FILE) ?: []) as $e) { if (($e['id'] ?? 0) === $want) $found = $e; }
    if (!$found || !is_array($found['before'] ?? null)) fail(404, 'Diese Version gibt es nicht mehr.');

    $clean = sanitize($found['before'], $curRev + 1, $user, $IDS, $TERMIN_KEYS);
    $changes = describe_changes($current, $clean, $IDS, $TERMIN_KEYS);
    if (!$changes) fail(400, 'Diese Version entspricht schon dem aktuellen Stand.');
    $when = '';
    $dt = strtotime($found['t'] ?? '');
    if ($dt) $when = ' vom ' . date('d.m.Y, H:i', $dt) . ' Uhr';
    array_unshift($changes, 'Zustand vor der Änderung #' . $want . $when . ' wiederhergestellt');
    write_data($DATA_FILE, $BAK_FILE, $clean);
    add_history($HIST_FILE, $HIST_MAX, $user, 'restore', $changes, $current);
    echo json_encode(['ok' => true, 'rev' => $clean['rev'], 'data' => $clean], JSON_UNESCAPED_UNICODE);
    exit;
}

/* ---------- Speichern ---------- */
if ($action !== 'save') fail(400, 'Unbekannte Aktion.');

$in = $req['data'] ?? null;
if (!is_array($in)) fail(400, 'Keine Daten.');

$current = read_current($DATA_FILE);
$curRev = (int)($current['rev'] ?? 0);
if ((int)($in['rev'] ?? 0) !== $curRev) {
    fail(409, 'Jemand anderes hat in der Zwischenzeit gespeichert. Bitte die Seite neu laden, damit nichts überschrieben wird.');
}

$clean = sanitize($in, $curRev + 1, $user, $IDS, $TERMIN_KEYS);
$oldT = [];
foreach (($current['spieltermine'] ?? []) as $r) { $q = [$r['a'], $r['b']]; sort($q); $oldT[implode('-', $q)] = $r; }
foreach ($clean['spieltermine'] as $i => $r) {
    $q = [$r['a'], $r['b']]; sort($q); $k = implode('-', $q);
    $same = isset($oldT[$k]) && $oldT[$k]['datum'] === $r['datum'] && ($oldT[$k]['zeit'] ?? '') === $r['zeit'];
    $clean['spieltermine'][$i]['am'] = ($same && !empty($oldT[$k]['am'])) ? $oldT[$k]['am'] : date('c');
}
$changes = describe_changes($current, $clean, $IDS, $TERMIN_KEYS);
if (!$changes) {
    echo json_encode(['ok' => true, 'rev' => $curRev, 'geaendert' => $current['geaendert'] ?? null, 'unchanged' => true], JSON_UNESCAPED_UNICODE);
    exit;
}

write_data($DATA_FILE, $BAK_FILE, $clean);
add_history($HIST_FILE, $HIST_MAX, $user, 'save', $changes, $current);

echo json_encode(['ok' => true, 'rev' => $clean['rev'], 'geaendert' => $clean['geaendert']], JSON_UNESCAPED_UNICODE);
