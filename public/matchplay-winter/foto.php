<?php
/* ==========================================================================
   Winter Matchplay Serie: Fotos pro Spieltag
   - Öffentlich: Fotos ansehen (nur freigegebene) und Fotos einsenden
   - Turnierleitung (mit Anmeldung): Fotos direkt hochladen, freigeben, löschen
   Benötigt die Datei api.php im selben Ordner (Benutzer und Passwörter).
   ========================================================================== */
define('MATCHPLAY_LIB', 1);
require __DIR__ . '/api.php';   /* Hilfsfunktionen und $ALLUSERS */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$FOTO_FILE = $DIR . '/fotos.php';      /* Liste der Fotos (nicht abrufbar) */
$FOTO_DIR  = $DIR . '/fotos';
$TAGS = ['1','2','3','4','5','finale'];
$MAX_BYTES = 15 * 1024 * 1024;

function foto_pub($e) {
    return ['id' => $e['id'], 'tag' => $e['tag'], 'von' => $e['von'], 't' => $e['t'], 'f' => 'fotos/' . $e['id'] . '.jpg', 'th' => 'fotos/' . $e['id'] . '_t.jpg'];
}

/* ---------- Freigegebene Fotos anzeigen ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $list = guarded_read($FOTO_FILE) ?: [];
    $out = [];
    foreach ($list as $e) { if (($e['status'] ?? '') === 'frei') $out[] = foto_pub($e); }
    echo json_encode(['ok' => true, 'fotos' => array_reverse($out)], JSON_UNESCAPED_UNICODE);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'Nicht erlaubt.');

/* Anmeldung (optional): nur für Turnierleitung */
$admin = false; $user = '';
if (isset($_POST['user'])) {
    $user = (string)$_POST['user']; $pass = $_POST['pass'] ?? '';
    if (!array_key_exists($user, $ALLUSERS) || strpos($ALLUSERS[$user], 'BITTE-AENDERN') === 0 || !pass_ok($ALLUSERS[$user], $pass)) {
        usleep(800000); fail(401, 'Name oder Passwort stimmt nicht.');
    }
    $admin = true;
}

$LOCK = @fopen($DIR . '/sperre.lock', 'c');
if ($LOCK) @flock($LOCK, LOCK_EX);

function foto_remove($FOTO_DIR, $id) {
    if (!preg_match('/^[a-f0-9]{16}$/', $id)) return;
    @unlink("$FOTO_DIR/$id.jpg"); @unlink("$FOTO_DIR/{$id}_t.jpg");
}

$action = (string)($_POST['action'] ?? 'upload');

/* ---------- Turnierleitung: Liste, freigeben, löschen ---------- */
if ($action === 'liste' || $action === 'frei' || $action === 'loeschen') {
    if (!$admin) fail(401, 'Bitte anmelden.');
    $list = guarded_read($FOTO_FILE) ?: [];
    if ($action !== 'liste') {
        $ids = array_filter(array_map('strval', (array)json_decode((string)($_POST['ids'] ?? '[]'), true)));
        $rest = [];
        foreach ($list as $e) {
            if (in_array($e['id'], $ids, true)) {
                if ($action === 'frei') { $e['status'] = 'frei'; $rest[] = $e; }
                else foto_remove($FOTO_DIR, $e['id']);
            } else $rest[] = $e;
        }
        $list = $rest;
        if (!guarded_write($FOTO_FILE, $list)) fail(500, 'Konnte nicht gespeichert werden.');
    }
    $out = [];
    foreach (array_reverse($list) as $e) { $x = foto_pub($e); $x['status'] = $e['status']; $out[] = $x; }
    echo json_encode(['ok' => true, 'fotos' => $out], JSON_UNESCAPED_UNICODE);
    exit;
}
if ($action !== 'upload') fail(400, 'Unbekannte Aktion.');

/* ---------- Foto hochladen ---------- */
if (!empty($_POST['website'])) { echo json_encode(['ok' => true]); exit; } /* Spam-Falle */
$tag = (string)($_POST['tag'] ?? '');
if (!in_array($tag, $TAGS, true)) fail(400, 'Bitte einen Spieltag wählen.');
$von = clean_str($_POST['von'] ?? '', 40);
if ($von === '') { if ($admin) $von = $user; else fail(400, 'Bitte deinen Namen eintragen.'); }

$f = $_FILES['foto'] ?? null;
if (!$f || ($f['error'] ?? 1) !== UPLOAD_ERR_OK) {
    $e = $f['error'] ?? 0;
    fail(400, ($e === UPLOAD_ERR_INI_SIZE || $e === UPLOAD_ERR_FORM_SIZE) ? 'Das Foto ist zu groß.' : 'Das Foto ist nicht angekommen. Bitte noch einmal versuchen.');
}
if ($f['size'] > $MAX_BYTES) fail(413, 'Das Foto ist zu groß (höchstens 15 MB).');
$info = @getimagesize($f['tmp_name']);
if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_GIF, IMAGETYPE_WEBP], true)) fail(400, 'Bitte ein Foto als JPG oder PNG senden.');
if ($info[0] * $info[1] > 50000000) fail(400, 'Das Foto hat zu viele Pixel.');

$now = time();
$ipHash = substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|matchplay'), 0, 16);
$list = guarded_read($FOTO_FILE) ?: [];
if (!$admin) {
    $recent = 0; $pending = 0;
    foreach ($list as $e) {
        if (($e['ip'] ?? '') === $ipHash && $now - (int)($e['ts'] ?? 0) < 3600) $recent++;
        if (($e['status'] ?? '') === 'wartend') $pending++;
    }
    if ($recent >= 10) fail(429, 'Zu viele Fotos in kurzer Zeit. Bitte später weitermachen.');
    if ($pending >= 150) fail(503, 'Es warten schon viele Fotos auf die Freigabe. Bitte später noch einmal versuchen.');
}
if (count($list) >= 800) fail(503, 'Die Fotogalerie ist voll.');

$img = @imagecreatefromstring((string)file_get_contents($f['tmp_name']));
if (!$img) fail(400, 'Das Foto konnte nicht gelesen werden.');
if ($info[2] === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
    $ex = @exif_read_data($f['tmp_name']);
    $o = (int)($ex['Orientation'] ?? 1);
    $ang = [3 => 180, 6 => -90, 8 => 90][$o] ?? 0;
    if ($ang) { $r = @imagerotate($img, $ang, 0); if ($r) $img = $r; }
}
function foto_scale($img, $max) {
    $w = imagesx($img); $h = imagesy($img);
    $k = min(1, $max / max($w, $h));
    $nw = max(1, (int)round($w * $k)); $nh = max(1, (int)round($h * $k));
    $dst = imagecreatetruecolor($nw, $nh);
    imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
    imagecopyresampled($dst, $img, 0, 0, 0, 0, $nw, $nh, $w, $h);
    return $dst;
}
if (!is_dir($FOTO_DIR) && !@mkdir($FOTO_DIR, 0755)) fail(500, 'Der Ordner fotos konnte nicht angelegt werden. Bitte beim Webspace Schreibrechte prüfen.');
$id = bin2hex(random_bytes(8));
$big = foto_scale($img, 1600); $th = foto_scale($img, 480);
$ok = @imagejpeg($big, "$FOTO_DIR/$id.jpg", 82) && @imagejpeg($th, "$FOTO_DIR/{$id}_t.jpg", 78);
if (!$ok) { foto_remove($FOTO_DIR, $id); fail(500, 'Das Foto konnte nicht gespeichert werden.'); }

$list[] = ['id' => $id, 'tag' => $tag, 'von' => $von, 't' => date('c'), 'ts' => $now, 'ip' => $ipHash, 'status' => $admin ? 'frei' : 'wartend'];
if (!guarded_write($FOTO_FILE, $list)) { foto_remove($FOTO_DIR, $id); fail(500, 'Das Foto konnte nicht eingetragen werden.'); }
echo json_encode(['ok' => true, 'status' => $admin ? 'frei' : 'wartend'], JSON_UNESCAPED_UNICODE);
