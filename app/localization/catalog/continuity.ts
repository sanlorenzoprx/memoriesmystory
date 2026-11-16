// L3 Continuity: Spanish interface copy and API error wording owned by this lane.
// English text is the key. Add entries here instead of editing messages.ts or
// errors.ts, so lanes working in parallel do not edit the same lines.
export const spanish: Readonly<Record<string, string>> = {
  "Check an export": "Comprobar una exportación",
  "Choose an export you saved before. Every file in it is checked against the list inside the export, on this device. Nothing is uploaded or changed.":
    "Elige una exportación que guardaste antes. Cada archivo se compara con la lista que lleva la exportación, en este dispositivo. No se sube ni se cambia nada.",
  "Export file (.zip)": "Archivo de exportación (.zip)",
  "Every file in this export matches its list.": "Cada archivo de esta exportación coincide con su lista.",
  "Some files in this export do not match its list.": "Algunos archivos de esta exportación no coinciden con su lista.",
  "Files that match: {matched} of {listed}": "Archivos que coinciden: {matched} de {listed}",
  "Listed but missing: {count}": "En la lista pero ausentes: {count}",
  "Changed since the export was made: {count}": "Cambiados desde que se hizo la exportación: {count}",
  "Added files that are not on the list: {count}": "Archivos añadidos que no están en la lista: {count}",
  "When it was made, this export said it was not complete. Open its index.html to read what it left out.":
    "Cuando se hizo, esta exportación indicó que no estaba completa. Abre su index.html para leer lo que dejó fuera.",
  "This check shows the files match the list inside the export. It cannot show the list itself was never edited.":
    "Esta comprobación muestra que los archivos coinciden con la lista de la exportación. No puede mostrar que la lista nunca se editó.",
  "This export could not be checked. Nothing was changed.": "No se pudo comprobar esta exportación. No se cambió nada.",
  "This file is not a ZIP export.": "Este archivo no es una exportación ZIP.",
  "This ZIP was compressed or repacked after export, so its files cannot be checked as saved. Use the original export file.":
    "Este ZIP se comprimió o se volvió a empaquetar después de exportarse, así que sus archivos no se pueden comprobar tal como se guardaron. Usa el archivo de exportación original.",
  "This ZIP is protected by a password and cannot be checked.": "Este ZIP está protegido con contraseña y no se puede comprobar.",
  "This ZIP uses a format this check does not read.": "Este ZIP usa un formato que esta comprobación no lee.",
  "This ZIP is damaged and cannot be read completely.": "Este ZIP está dañado y no se puede leer por completo.",
  "This ZIP has no manifest.json, so it is not an export from this app.":
    "Este ZIP no tiene manifest.json, así que no es una exportación de esta aplicación.",
  "This export's manifest.json cannot be read.": "No se puede leer el manifest.json de esta exportación.",
  "Export prepared on our server": "Exportación preparada en nuestro servidor",
  "Your archive is too large to prepare on this device. We can prepare it on our server instead: every file is checked against the preserved original, and you save it in parts.":
    "Tu archivo es demasiado grande para prepararlo en este dispositivo. Podemos prepararlo en nuestro servidor: cada archivo se compara con el original preservado y lo guardas en partes.",
  "Prepare it on our server": "Prepararlo en nuestro servidor",
  "Your export is ready in {count} parts.": "Tu exportación está lista en {count} partes.",
  "Save part {part} of {parts}": "Guardar la parte {part} de {parts}",
  "Each part is a complete export you can check with Check an export. The parts are kept until {date}, then removed.":
    "Cada parte es una exportación completa que puedes comprobar con Comprobar una exportación. Las partes se guardan hasta el {date} y luego se eliminan.",
};
export const errors: Readonly<Record<string, string>> = {
  archive_verify_not_zip: "This file is not a ZIP export.",
  archive_verify_compressed:
    "This ZIP was compressed or repacked after export, so its files cannot be checked as saved. Use the original export file.",
  archive_verify_encrypted: "This ZIP is protected by a password and cannot be checked.",
  archive_verify_unsupported: "This ZIP uses a format this check does not read.",
  archive_verify_damaged: "This ZIP is damaged and cannot be read completely.",
  archive_verify_no_manifest: "This ZIP has no manifest.json, so it is not an export from this app.",
  archive_verify_manifest_invalid: "This export's manifest.json cannot be read.",
};
