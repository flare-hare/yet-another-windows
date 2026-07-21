<?php
/**
 * order.php — приём заявки из конструктора «Оконика».
 * Принимает JSON от формы (checkout.js), отправляет уведомление в Telegram и на
 * почту компании, шлёт письмо-подтверждение клиенту, пишет заявку в лог-файл.
 *
 * НАСТРОЙКА: заполните константы в блоке CONFIG ниже (токен бота, chat_id, почты).
 * Файл кладётся в корень сайта рядом с index.html (fetch('order.php')).
 */

// ==================== CONFIG (заполнить своими значениями) ====================
const TG_BOT_TOKEN = '';       // токен от @BotFather
const TG_CHAT_ID   = '';          // куда слать (ваш id или id группы)
const MAIL_TO      = 'info@okonika.ru';           // почта компании (куда заявка)
const MAIL_FROM    = 'no-reply@okonika.ru';       // от кого письма (домен вашего сайта)
const COMPANY_NAME = 'Оконика';
const LOG_FILE     = __DIR__ . '/orders.log';     // лог заявок (защитить от веб-доступа, см. README)
// =============================================================================

header('Content-Type: application/json; charset=utf-8');

// Константы в переменные — чтобы работала интерполяция в строках "{$company}"
$company = COMPANY_NAME;

// --- Разрешаем только POST ---
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method']);
    exit;
}

// --- Читаем и разбираем JSON тела запроса ---
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!is_array($data) || empty($data['customer']) || empty($data['items'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'bad_request']);
    exit;
}

// --- Санитизация ввода (без зависимости от mbstring) ---
function clean($v)
{
    $s = trim((string)($v ?? ''));
    if (function_exists('mb_substr')) {
        return mb_substr($s, 0, 500);
    }
    return substr($s, 0, 500);
}

// Юникод-обёртки с фолбэком: на shared-хостинге mbstring может быть выключен.
// Длину/срез считаем в СИМВОЛАХ (не байтах) даже без mbstring — через regex //u,
// иначе выравнивание колонок в моноширинном блоке съедет на кириллице.
function strlen_u($s)
{
    if (function_exists('mb_strlen')) {
        return mb_strlen($s);
    }
    return preg_match_all('/./u', $s);
}

function substr_u($s, $start, $len = null)
{
    if (function_exists('mb_substr')) {
        return $len === null ? mb_substr($s, $start) : mb_substr($s, $start, $len);
    }
    preg_match_all('/./u', $s, $m);
    $slice = $len === null ? array_slice($m[0], $start) : array_slice($m[0], $start, $len);
    return implode('', $slice);
}

function strpos_u($haystack, $needle)
{
    if (function_exists('mb_strpos')) {
        return mb_strpos($haystack, $needle);
    }
    $bytePos = strpos($haystack, $needle);
    return $bytePos === false ? false : preg_match_all('/./u', substr($haystack, 0, $bytePos));
}

$c = $data['customer'];
$name    = clean($c['name'] ?? '');
$phone   = clean($c['phone'] ?? '');
$email   = clean($c['email'] ?? '');
$comment = clean($c['comment'] ?? '');
$consent = !empty($c['consent']);

// --- Валидация на сервере (не доверяем только фронту) ---
$errors = [];
if (strlen_u($name) < 2)                                    $errors[] = 'name';
if (preg_match_all('/\d/', $phone) < 10)                    $errors[] = 'phone';
if (!filter_var($email, FILTER_VALIDATE_EMAIL))            $errors[] = 'email';
if (!$consent)                                              $errors[] = 'consent';
if (!is_array($data['items']) || count($data['items']) === 0) $errors[] = 'items';

if ($errors) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'validation', 'fields' => $errors]);
    exit;
}

// --- Номер заказа: доверяем клиентскому, иначе генерируем ---
$orderNumber = clean($data['orderNumber'] ?? '');
if ($orderNumber === '') {
    $orderNumber = 'ОК-' . date('ymd') . '-' . random_int(1000, 9999);
}

// Итог: берём отформатированный из клиента (уже со знаком «≈»),
// иначе строим fallback тоже со знаком «≈» (цена на сайте примерная).
$totalFormatted = clean($data['totalFormatted'] ?? '≈ ' . ($data['total'] ?? '0') . ' ₽');

// Экранирование для Telegram HTML (имя/комментарий могут содержать < > &).
function esc($s)
{
    return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
}

// Ширина «метки» детали (в символах) для выравнивания колонки в моноширинном
// блоке: «• Профиль:    Стандарт». Считаем по самой длинной метке всех позиций.
function detailLabelWidth(array $items)
{
    $max = 0;
    foreach ($items as $it) {
        foreach (($it['details'] ?? []) as $d) {
            $pos = strpos_u($d, ':');
            if ($pos !== false) {
                $max = max($max, strlen_u(substr_u($d, 0, $pos + 1))); // с двоеточием
            }
        }
    }
    return $max;
}

// --- Состав позиций: для Telegram (HTML), письма (HTML) и plain (запас) ---
$labelW = detailLabelWidth($data['items']);
$itemsHtml  = ''; // цитаты-блоки для бота
$itemsEmail = ''; // HTML-карточки для письма
$itemsPlain = ''; // без разметки (запасной вариант)
foreach ($data['items'] as $i => $it) {
    $n     = $i + 1;
    $title = clean($it['title'] ?? 'Окно');
    $size  = clean($it['size'] ?? '');
    // Цена с разделителем тысяч: 24471 → «24 471» (неразрывный пробел)
    $price = number_format((int) ($it['price'] ?? 0), 0, '', "\u{00A0}");

    // Шапка позиции (цитата бота)
    $head = "<b>{$n}.  " . esc($title) . '</b>'
        . "\n📐  " . esc($size)
        . "\n💸  ≈ {$price} ₽";

    // Письмо (plain): заголовок позиции
    $itemsPlain .= "{$n}. {$title}, {$size} — ≈ {$price} руб.\n";

    // Детали: моноширинный блок (бот) + строки для письма
    $lines = '';        // для бота (выровненные колонки)
    $detailRowsEmail = ''; // для письма (таблица метка/значение)
    foreach (($it['details'] ?? []) as $d) {
        $d = clean($d);
        $pos = strpos_u($d, ':');
        if ($pos !== false) {
            $label = substr_u($d, 0, $pos + 1);    // «Профиль:»
            $value = trim(substr_u($d, $pos + 1)); // «Стандарт»
            $pad   = str_repeat(' ', max(1, $labelW - strlen_u($label) + 2));
            $lines .= '• ' . $label . $pad . $value . "\n";
            $detailRowsEmail .= '<tr>'
                . '<td style="padding:2px 12px 2px 0;color:#6a7b7b;white-space:nowrap;vertical-align:top;">'
                . esc($label) . '</td>'
                . '<td style="padding:2px 0;color:#1d2b2b;">' . esc($value) . '</td></tr>';
        } else {
            $lines .= '• ' . $d . "\n";
            $detailRowsEmail .= '<tr><td colspan="2" style="padding:2px 0;color:#1d2b2b;">'
                . esc($d) . '</td></tr>';
        }
        $itemsPlain .= '   - ' . $d . "\n";
    }

    // HTML-карточка позиции для письма
    $itemsEmail .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        . 'style="margin:0 0 12px;border:1px solid #e2ecec;border-radius:10px;'
        . 'background:#f7fbfb;border-collapse:separate;"><tr><td style="padding:14px 16px;">'
        . '<div style="font-weight:700;font-size:15px;color:#1d2b2b;">' . $n . '. ' . esc($title) . '</div>'
        . '<div style="color:#6a7b7b;font-size:13px;margin:2px 0 8px;">📐 ' . esc($size)
        . ' &nbsp;·&nbsp; <span style="color:#3f8f8f;font-weight:600;">≈ ' . $price . ' ₽</span></div>'
        . '<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:13px;">'
        . $detailRowsEmail . '</table>'
        . '</td></tr></table>';

    $mono = $lines !== '' ? "\n<code>" . esc(rtrim($lines, "\n")) . '</code>' : '';
    $itemsHtml .= "<blockquote expandable>{$head}{$mono}</blockquote>\n";
}

// ==================== 1. Лог в файл (сначала — надёжно) ====================
$logLine = json_encode([
    'time'   => date('c'),
    'order'  => $orderNumber,
    'name'   => $name,
    'phone'  => $phone,
    'email'  => $email,
    'comment' => $comment,
    'total'  => $data['total'] ?? null,
    'items'  => $data['items'],
    'ip'     => $_SERVER['REMOTE_ADDR'] ?? '',
], JSON_UNESCAPED_UNICODE);
@file_put_contents(LOG_FILE, $logLine . "\n", FILE_APPEND | LOCK_EX);

// ==================== 2. Telegram ====================
function sendTelegram($text)
{
    if (TG_BOT_TOKEN === 'ВСТАВЬТЕ_ТОКЕН_БОТА') return false;
    $url = 'https://api.telegram.org/bot' . TG_BOT_TOKEN . '/sendMessage';
    $payload = http_build_query([
        'chat_id' => TG_CHAT_ID,
        'text' => $text,
        'parse_mode' => 'HTML',
    ]);
    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => $payload,
            'timeout' => 10,
        ],
    ]);
    $res = @file_get_contents($url, false, $ctx);
    return $res !== false;
}

// Дата и время заявки по Москве (сервер может быть в UTC).
$tz = new DateTimeZone('Europe/Moscow');
$now = new DateTime('now', $tz);
$dateStr = $now->format('d.m.Y');
$timeStr = $now->format('H:i');

// Телефон в едином виде «+7 (999) 999-99-99» из любых введённых цифр.
function formatPhone($raw)
{
    $digits = preg_replace('/\D/', '', (string) $raw);
    // нормализуем ведущую 8 → 7
    if (strlen($digits) === 11 && $digits[0] === '8') {
        $digits = '7' . substr($digits, 1);
    }
    if (strlen($digits) === 11 && $digits[0] === '7') {
        return sprintf(
            '+7 (%s) %s-%s-%s',
            substr($digits, 1, 3),
            substr($digits, 4, 3),
            substr($digits, 7, 2),
            substr($digits, 9, 2)
        );
    }
    return $raw; // нестандартный формат — оставляем как есть
}

$phonePretty = formatPhone($phone);
$phoneTel = '+' . preg_replace('/\D/', '', preg_replace('/^8/', '7', preg_replace('/\D/', '', $phone)));

// Контакты — сворачиваемая цитата, телефон и почта КЛИКАБЕЛЬНЫ.
$contacts = "<blockquote expandable>🧑🏻‍💼  " . esc($name) . "\n"
    . "☎️  <a href=\"tel:{$phoneTel}\">" . esc($phonePretty) . "</a>\n"
    . "✉️  <a href=\"mailto:{$email}\">" . esc($email) . '</a>'
    . ($comment ? "\n💭  " . esc($comment) : '')
    . '</blockquote>';

$tgText = "<b><i>№ {$orderNumber}</i></b>\n"
    . "📅  {$dateStr}       🕝  {$timeStr}\n\n"
    . $contacts . "\n\n"
    . "📋  <b>Состав заказа:</b>\n\n"
    . $itemsHtml
    . "\n💸  <b>Итого: {$totalFormatted}</b>";
$tgOk = sendTelegram($tgText);

// ==================== ПИСЬМА (HTML, фирменный стиль) ====================

/**
 * Общий каркас HTML-письма: шапка с логотипом-градиентом + контент + подвал.
 * @param string $company   название компании
 * @param string $preheader короткий текст-превью (в списке писем)
 * @param string $content    HTML-содержимое тела
 * @return string
 */
function emailLayout($company, $preheader, $content)
{
    return '<!doctype html><html lang="ru"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        . '<body style="margin:0;padding:0;background:#eef4f4;font-family:Arial,Helvetica,sans-serif;">'
        . '<span style="display:none;max-height:0;overflow:hidden;opacity:0;">' . esc($preheader) . '</span>'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef4f4;padding:24px 12px;">'
        . '<tr><td align="center">'
        . '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(40,80,80,.08);">'
        // Шапка с градиентом и «окном»
        . '<tr><td style="background:linear-gradient(135deg,#88bfbf,#60a9a9);padding:24px 28px;">'
        . '<table role="presentation" cellpadding="0" cellspacing="0"><tr>'
        . '<td style="vertical-align:middle;padding-right:12px;">'
        . '<div style="width:36px;height:36px;border:3px solid #fff;border-radius:6px;position:relative;">'
        . '<div style="position:absolute;left:50%;top:0;bottom:0;width:3px;background:#fff;transform:translateX(-50%);"></div>'
        . '<div style="position:absolute;top:50%;left:0;right:0;height:3px;background:#fff;transform:translateY(-50%);"></div>'
        . '</div></td>'
        . '<td style="vertical-align:middle;color:#fff;font-size:22px;font-weight:800;letter-spacing:.5px;">' . esc($company) . '</td>'
        . '</tr></table></td></tr>'
        // Контент
        . '<tr><td style="padding:28px;">' . $content . '</td></tr>'
        // Подвал
        . '<tr><td style="padding:18px 28px;border-top:1px solid #eef4f4;color:#8a9a9a;font-size:12px;line-height:1.5;">'
        . 'Это письмо отправлено автоматически по заявке с сайта «' . esc($company) . '».<br>'
        . 'Цены предварительные и могут отличаться примерно на ±500 ₽ за позицию.'
        . '</td></tr>'
        . '</table></td></tr></table></body></html>';
}

/** Строка «Итого» для письма. */
$totalRow = '<div style="text-align:right;font-size:18px;font-weight:800;color:#1d2b2b;'
    . 'border-top:2px solid #e2ecec;padding-top:14px;margin-top:4px;">Итого: ' . esc($totalFormatted) . '</div>';

/** Отправка HTML-письма. */
function sendMail($to, $subject, $html, $replyTo = null)
{
    $headers = 'From: =?UTF-8?B?' . base64_encode(COMPANY_NAME) . '?= <' . MAIL_FROM . ">\r\n"
        . "MIME-Version: 1.0\r\n"
        . "Content-Type: text/html; charset=UTF-8\r\n";
    if ($replyTo) {
        $headers .= "Reply-To: {$replyTo}\r\n";
    }
    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    return @mail($to, $encodedSubject, $html, $headers);
}

// --- Письмо компании ---
$contentCompany =
    '<div style="font-size:18px;font-weight:800;color:#1d2b2b;">Новая заявка № ' . esc($orderNumber) . '</div>'
    . '<div style="color:#6a7b7b;font-size:13px;margin:2px 0 18px;">📅 ' . $dateStr . ' &nbsp; 🕝 ' . $timeStr . '</div>'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7fbfb;border-radius:10px;margin-bottom:20px;">'
    . '<tr><td style="padding:14px 16px;font-size:14px;line-height:1.7;color:#1d2b2b;">'
    . '🧑🏻‍💼 <b>' . esc($name) . '</b><br>'
    . '☎️ <a href="tel:' . $phoneTel . '" style="color:#3f8f8f;">' . esc($phonePretty) . '</a><br>'
    . '✉️ <a href="mailto:' . esc($email) . '" style="color:#3f8f8f;">' . esc($email) . '</a>'
    . ($comment ? '<br>💬 ' . esc($comment) : '')
    . '</td></tr></table>'
    . '<div style="font-weight:700;color:#1d2b2b;margin-bottom:12px;">Состав заказа</div>'
    . $itemsEmail
    . $totalRow;
$mailCompanyOk = sendMail(MAIL_TO, "Заявка {$orderNumber} — {$company}",
    emailLayout($company, "Новая заявка № {$orderNumber}", $contentCompany), $email);

// --- Письмо-подтверждение клиенту ---
$contentClient =
    '<div style="font-size:18px;font-weight:800;color:#1d2b2b;">Спасибо за заявку, ' . esc($name) . '!</div>'
    . '<div style="color:#1d2b2b;font-size:14px;line-height:1.7;margin:12px 0 18px;">'
    . 'Ваш заказ <b>№ ' . esc($orderNumber) . '</b> принят. Мы свяжемся с вами в ближайшее время '
    . 'для подтверждения и уточнения деталей.'
    . '</div>'
    . '<div style="font-weight:700;color:#1d2b2b;margin-bottom:12px;">Ваш заказ</div>'
    . $itemsEmail
    . $totalRow;
sendMail($email, "Ваш заказ {$orderNumber} принят — {$company}",
    emailLayout($company, "Заказ № {$orderNumber} принят", $contentClient));

// ==================== Ответ фронту ====================
// Успех, если удалось хотя бы залогировать (уведомления — best effort).
echo json_encode([
    'ok' => true,
    'orderNumber' => $orderNumber,
    'delivered' => ['telegram' => $tgOk, 'emailCompany' => $mailCompanyOk],
], JSON_UNESCAPED_UNICODE);
