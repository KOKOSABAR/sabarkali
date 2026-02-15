/**
 * Infinity Hub - Google Apps Script Backend (Code.gs) v2.0
 * 
 * Fields in Spreadsheet (A:E):
 * [0] Timestamp, [1] Category, [2] Title, [3] Content, [4] NoteID
 */

const SPREADSHEET_ID = '1akkwLxXV36CRMfCwDexKc3c9lweWpW7Wsfq9PtUnBlI';
const DRIVE_FOLDER_ID = '1QaWxbEajWCL2BBTAQLiFLERCpUEg7TTV'; 

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'uploadExtension') return uploadExtension(data);
    if (action === 'saveNote') return saveNote(data); // Create or Update
    if (action === 'deleteNote') return deleteNote(data);

    return response({ success: false, error: 'Invalid action' });
  } catch (err) {
    return response({ success: false, error: err.toString() });
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === 'getExtensions') return getExtensions();
    if (action === 'getNotes') return getNotes();
    if (action === 'getKasDashboard') return getKasDashboard(e);
    if (action === 'getSheetData') return getSheetData(e);
    return response({ success: false, error: 'Invalid action' });
  } catch (err) {
    return response({ success: false, error: err.toString() });
  }
}

// --- Note Logic ---

function saveNote(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheets()[0];
  const values = sheet.getDataRange().getValues();
  const timestamp = new Date().toLocaleString();
  
  let rowIndex = -1;
  // Look for existing NoteID to Update
  if (data.id) {
    for (let i = 0; i < values.length; i++) {
      if (values[i][4] == data.id) {
        rowIndex = i + 1;
        break;
      }
    }
  }

  if (rowIndex > 0) {
    // Edit existing
    sheet.getRange(rowIndex, 2, 1, 3).setValues([[data.category, data.title, data.content]]);
  } else {
    // New Note
    const newId = data.id || 'N' + new Date().getTime();
    sheet.appendRow([timestamp, data.category, data.title, data.content, newId]);
  }
  
  return response({ success: true });
}

function deleteNote(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheets()[0];
  const values = sheet.getDataRange().getValues();
  
  for (let i = 0; i < values.length; i++) {
    if (values[i][4] == data.id) {
      sheet.deleteRow(i + 1);
      return response({ success: true });
    }
  }
  return response({ success: false, error: 'Note not found' });
}

function getNotes() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheets()[0];
  const values = sheet.getDataRange().getValues();
  
  if (values.length <= 1) return response({ success: true, data: [] });

  const data = values.slice(1).map(row => ({
    date: row[0],
    category: row[1],
    title: row[2],
    content: row[3],
    id: row[4]
  }));
  
  return response({ success: true, data: data });
}

// --- Extension Logic --- (Keep existing)
function uploadExtension(data) {
  const folder = DRIVE_FOLDER_ID ? DriveApp.getFolderById(DRIVE_FOLDER_ID) : DriveApp.getRootFolder();
  const decoded = Utilities.base64Decode(data.base64);
  const blob = Utilities.newBlob(decoded, 'application/zip', data.fileName);
  const file = folder.createFile(blob);
  if (data.description) file.setDescription(data.description);
  return response({ success: true, fileId: file.getId() });
}

function getExtensions() {
  const query = "trashed = false";
  const parentFolder = DRIVE_FOLDER_ID ? DriveApp.getFolderById(DRIVE_FOLDER_ID) : DriveApp.getRootFolder();
  const files = parentFolder.searchFiles(query);
  const results = [];
  while (files.hasNext()) {
    const file = files.next();
    results.push({
      id: file.getId(), name: file.getName(), size: file.getSize(), 
      description: file.getDescription() || '', downloadUrl: file.getDownloadUrl()
    });
  }
  return response({ success: true, data: results });
}

// --- Kas Dashboard: getKasDashboard & getSheetData ada di CodeKas.gs (pakai spreadsheet lain) ---

function response(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
