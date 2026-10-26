# ═══════════════════════════════════════════════════════════════════════════
#  construir-script.ps1 — Sistema ETI Capacitaciones (_ETI_SRC_V1, 26-oct-2026)
#  script.js es GENERADO: se arma concatenando src\NN-*.js en orden de nombre.
#  Para cambiar el sistema: editar el archivo de src\ que corresponda y correr
#      cd C:\sistema-eti ; .\construir-script.ps1
#  Luego subir el numero de version en index.html (script.js?v=...) y publicar.
#  Los modulos ES independientes (presencia/chat, alertas, cierre, estadisticas)
#  viven en js\ y NO pasan por aqui.
# ═══════════════════════════════════════════════════════════════════════════
Set-Location $PSScriptRoot
$partes = Get-ChildItem -Path "src" -Filter "*.js" | Sort-Object Name
$sb = New-Object System.Text.StringBuilder
[void]$sb.Append("// GENERADO por construir-script.ps1 — NO EDITAR AQUI: editar src\NN-*.js y volver a construir (_ETI_SRC_V1)`n")
foreach ($p in $partes) {
  [void]$sb.Append("// ═══════════ src/$($p.Name) ═══════════`n")
  $t = [System.IO.File]::ReadAllText($p.FullName, [System.Text.Encoding]::UTF8)
  if (-not $t.EndsWith("`n")) { $t += "`n" }
  [void]$sb.Append($t)
}
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot "script.js"), $sb.ToString(), $utf8)
Write-Host ("script.js construido: " + $partes.Count + " partes, " + ((Get-Content script.js).Count) + " lineas") -ForegroundColor Green
