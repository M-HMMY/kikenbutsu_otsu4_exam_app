# デスクトップに「生成AIパスポート 学習アプリ」のショートカットを作る。
#
# なぜスクリプトにするか：手で作ると、作り直すたびに同じ落とし穴を踏むため。
#
#   - **IconLocation は、作成後に必ず読み直して確かめること。**
#     パスの区切りがエスケープとして消費され、壊れたパスが入ることがある。
#     姉妹アプリで実際に踏んだ。このスクリプトは最後に読み直して照合する
#   - 起動は launch.cmd を経由する。PowerShell を直接ターゲットにすると、
#     実行ポリシーに引っかかる環境がある
#   - **このファイルは BOM 付き UTF-8 で保存すること。**
#     Windows PowerShell 5.1 は BOM のない .ps1 を cp932 として読むため、
#     BOM を落とすと日本語の行で構文エラーになる（これも実際に踏んだ）
#
# 使い方：
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\make_shortcut.ps1

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$target = Join-Path $PSScriptRoot 'launch.cmd'
$icon = Join-Path $PSScriptRoot 'app.ico'
$desktop = [Environment]::GetFolderPath('Desktop')
$linkPath = Join-Path $desktop '危険物乙4 学習アプリ.lnk'

foreach ($p in @($target, $icon)) {
    if (-not (Test-Path $p)) { throw "見つかりません: $p" }
}

$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($linkPath)
$link.TargetPath = $target
$link.WorkingDirectory = $root
$link.IconLocation = "$icon,0"
$link.Description = '危険物取扱者試験 乙種第4類の学習アプリを起動します'
$link.WindowStyle = 1
$link.Save()

# **作りっぱなしにしない。**読み直して、意図した値が入っているか確かめる。
$check = $shell.CreateShortcut($linkPath)

Write-Host ''
Write-Host '  ショートカットを作りました。' -ForegroundColor Cyan
Write-Host "    場所        : $linkPath"
Write-Host "    起動するもの: $($check.TargetPath)"
Write-Host "    作業フォルダ: $($check.WorkingDirectory)"
Write-Host "    アイコン    : $($check.IconLocation)"
Write-Host ''

$ok = $true
if ($check.TargetPath -ne $target) {
    Write-Host "  × 起動するものが違います（期待: $target）" -ForegroundColor Red
    $ok = $false
}
if ($check.WorkingDirectory -ne $root) {
    Write-Host "  × 作業フォルダが違います（期待: $root）" -ForegroundColor Red
    $ok = $false
}
if ($check.IconLocation -ne "$icon,0") {
    Write-Host "  × アイコンのパスが壊れています（期待: $icon,0）" -ForegroundColor Red
    $ok = $false
}

if (-not $ok) { exit 1 }

Write-Host '  読み直して確認しました。問題ありません。' -ForegroundColor Green
Write-Host ''
