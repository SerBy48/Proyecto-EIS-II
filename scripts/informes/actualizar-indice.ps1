# ============================================================================
# Actualiza la tabla de contenido del informe con Microsoft Word y exporta un
# PDF de control.
#
#   powershell -ExecutionPolicy Bypass -File scripts/informes/actualizar-indice.ps1 `
#     -Docx docs/informes/Informe_Estrategias_Validacion_Pruebas.docx -Pdf <ruta.pdf>
#
# La libreria docx escribe el campo de la tabla de contenido, pero solo Word
# calcula los numeros de pagina. Sin este paso, Word pide actualizar los campos
# al abrir el documento.
# ============================================================================
param(
  [Parameter(Mandatory = $true)][string]$Docx,
  [string]$Pdf
)

$rutaDocx = (Resolve-Path $Docx).Path
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $documento = $word.Documents.Open($rutaDocx)
  foreach ($indice in $documento.TablesOfContents) { $indice.Update() }
  $documento.Fields.Update() | Out-Null
  $documento.Save()
  if ($Pdf) {
    # 17 = wdExportFormatPDF
    $documento.ExportAsFixedFormat($Pdf, 17)
  }
  Write-Output "Paginas: $($documento.ComputeStatistics(2))"
  $documento.Close()
} finally {
  try { $word.Quit() } catch { }  # Word a veces ya cerro el proceso RPC
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
