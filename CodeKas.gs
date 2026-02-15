/**
 * CodeKas.gs - V3.6 (ADAPTIVE LAYOUT FIX)
 * Memperbaiki tabel Sesuai Doc yang memiliki layout terbalik
 */

var KAS_SPREADSHEET_ID = '1u0QS7OLka65DBL1pSoZK3S0Twqt_VidDfAR2kH2v4zw';

function doGet(e) {
  try { return getKasDashboard(e); } 
  catch (err) { return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON); }
}

function getKasDashboard(e) {
  var ss = SpreadsheetApp.openById(KAS_SPREADSHEET_ID);
  var targetTab = (e && e.parameter && e.parameter.tab) ? e.parameter.tab : "DASHBOARD";
  var isForceRefresh = (e && e.parameter && e.parameter.refresh === "true");
  var cache = CacheService.getScriptCache();
  
  // Ambil sheet target
  var sheet = ss.getSheetByName(targetTab) || ss.getSheets().filter(s => s.getName().toUpperCase().indexOf('DASHBOARD') >= 0)[0] || ss.getSheets()[0];
  var activeTabName = sheet.getName().toUpperCase();

  // FORCE RECALCULATION & CLEAR CACHE
  if (isForceRefresh) {
    try {
      sheet.getRange("Z1").setValue("Last Sync: " + new Date().toLocaleString());
      SpreadsheetApp.flush(); 
      cache.remove("KAS_DASH_DATA"); // Hapus cache agar data segar diambil
    } catch(e) {}
  }
  
  // 1. Ambil data Tab Aktif (Selalu dibaca agar update)
  var lastRow = Math.min(sheet.getLastRow(), 300);
  var lastCol = Math.min(sheet.getLastColumn(), 50);
  if (lastRow < 1) lastRow = 1;
  if (lastCol < 1) lastCol = 1;
  var values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();

  var out = {
    success: true,
    activeSheetTab: activeTabName,
    data: {
      realTimeKas1: { headers: [], rows: [] },
      sesuaiDocKas1: { headers: [], rows: [] },
      crosscheck: { status: [], labels: [] },
      balance: {},
      depositBank: [], depositWallet: [],
      withdraw: [],
      pendinganBank: [], pendinganWallet: [],
      saldoDepo: [], saldoWd: [], saldoEwallet: [],
      sheetTable: { headers: [], rows: [], summary: {} }
    }
  };

  // 2. Logika Khusus Tab (ALL SALDO / DATA KAS 1 / etc)
  if (activeTabName !== "DASHBOARD") {
    if (activeTabName === "DATA KAS 1") {
         // Logika khusus DATA KAS 1
         var combinedHeaders = [];
         var maxCols = values[2].length;
         for(var col=0; col<maxCols; col++) {
           var h1 = String(values[0][col] || "").trim();
           var h2 = String(values[1][col] || "").trim();
           var h3 = String(values[2][col] || "").trim();
           combinedHeaders.push((h2 + " " + h3).trim() || h1 || "COL "+(col+1));
         }
         out.data.sheetTable.headers = combinedHeaders;
         out.data.sheetTable.rows = values.slice(3);
      } else if (activeTabName === "ALL SALDO") {
       out.data.sheetTable.blocks = [];
       for (var r = 0; r < values.length - 2; r++) {
          for (var c = 0; c < values[r].length; c++) {
             var cell = String(values[r][c] || "").toUpperCase().trim();
             if (cell === "DOC" && String(values[r+1][c] || "").toUpperCase().trim() === "KAS") {
                var title = "DATA";
                var foundTitle = false;
                for (var tr = r; tr >= Math.max(0, r - 15); tr--) {
                  for (var tc = 0; tc <= Math.min(c, 3); tc++) {
                    var tVal = String(values[tr][tc] || "").trim();
                    if (tVal) {
                      var upT = tVal.toUpperCase();
                      if (["DEPO","BANK","QRIS","SALDO","WD","KAS"].some(k => upT.indexOf(k) >= 0)) { title = tVal; foundTitle = true; break; }
                    }
                  }
                  if (foundTitle) break;
                }
                var block = { title: title, headers: [], doc: [], kas: [], hasil: [] };
                for (var col = c + 1; col < values[r].length; col++) {
                   var dVal = values[r][col]; var kVal = values[r+1][col]; var hVal = values[r+2] ? values[r+2][col] : "";
                   if (!String(dVal || '').trim() && !String(kVal || '').trim()) { if (col > c + 5) break; continue; }
                   var h_pts = [];
                   for(var hidx=1; hidx<=4; hidx++) { if (values[r-hidx] && values[r-hidx][col]) { var headCell = String(values[r-hidx][col]).trim(); if(headCell) h_pts.unshift(headCell); } }
                   block.headers.push(h_pts.join("<br>")); block.doc.push(dVal); block.kas.push(kVal); block.hasil.push(hVal);
                }
                if (block.doc.length > 0) out.data.sheetTable.blocks.push(block);
                r += 2; break;
             }
          }
       }
       out.data.sheetTable.rows = values.slice(1).filter(row => {
          var txt = row.join(" ").toUpperCase();
          return !(txt.indexOf("DEPO") >= 0 && !row.some(c => !isNaN(parseFloat(c)) && isFinite(c)));
       });
    } else if (activeTabName.indexOf("KERUGIAN") >= 0) {
         // Logika khusus KERUGIAN PT: Header biasanya di baris 2
         out.data.sheetTable.headers = values[1] || values[0];
         out.data.sheetTable.rows = values.slice(2);
      } else {
       out.data.sheetTable.headers = values[0];
       out.data.sheetTable.rows = values.slice(1);
    }
    // Summary
    for (var r = 0; r < Math.min(10, values.length); r++) {
       for (var c = 0; c < values[r].length; c++) {
          var cellTxt = String(values[r][c] || '').toUpperCase().trim();
          if (["SALDO KAS","SELISIH","KERUGIAN PT","TOTAL"].some(k => cellTxt.indexOf(k) >= 0)) {
             var val = findValueNearby(values, r, c);
             if (val && val !== "-" && val !== "") out.data.sheetTable.summary[cellTxt] = val;
          }
       }
    }
  }

  // 3. AMBIL DATA DASHBOARD (DARI CACHE ATAU BACA SHEET)
  var dashDataJson = cache.get("KAS_DASH_DATA");
  var dashData = null;
  
  if (dashDataJson) {
    try { dashData = JSON.parse(dashDataJson); } catch(e) {}
  }

  if (!dashData) {
    // Jika tidak ada di cache, baca dari Dashboard Sheet
    var dashSheet = ss.getSheets().filter(s => s.getName().toUpperCase().indexOf('DASHBOARD') >= 0)[0];
    var v = dashSheet ? dashSheet.getRange(1, 1, 200, 30).getDisplayValues() : values;
    
    dashData = {
      realTimeKas1: { headers: [], rows: [] },
      sesuaiDocKas1: { headers: [], rows: [] },
      crosscheck: { status: [], labels: [] },
      balance: {},
      depositBank: [], depositWallet: [],
      withdraw: [],
      pendinganBank: [], pendinganWallet: []
    };

    var rtPos = null; var docPos = null;
    for (var r = 0; r < v.length; r++) {
      for (var c = 0; c < v[r].length; c++) {
        var cell = String(v[r][c] || '').toUpperCase().trim();
        if (cell === "REAL TIME KAS 1") rtPos = { r: r, c: c };
        if (cell === "SESUAI DOC KAS 1") docPos = { r: r, c: c };
        if (cell.indexOf("REAL TIME BALANCE") >= 0) dashData.balance["REAL TIME BALANCE"] = findValueNearby(v, r, c);
        if (cell.indexOf("BALANCE KAS 1") >= 0) dashData.balance["BALANCE KAS 1"] = findValueNearby(v, r, c);
        if (cell === "STATUS") dashData.crosscheck.status = v[r].slice(c + 1, c + 15).filter(val => String(val).trim() !== "");
        if (cell === "CROSSCHECK") dashData.crosscheck.labels = v[r].slice(c + 1, c + 15).filter(val => String(val).trim() !== "");
      }
    }
    
    // Find header row for Real Time Kas 1
    if (rtPos) {
      for (var i = 1; i < 5; i++) {
        if (v[rtPos.r + i]) {
          var row = v[rtPos.r + i];
          var colFound = -1;
          for(var j=0; j<row.length; j++) if(String(row[j]).toUpperCase().trim() === "TANGGAL") { colFound = j; break; }
          if (colFound >= 0) {
            dashData.realTimeKas1 = extractTableAdaptive(v, rtPos.r + i, colFound, "DOWN");
            break;
          }
        }
      }
    }

    // Find header row for Sesuai Doc Kas 1
    if (docPos) {
      for (var i = 1; i < 5; i++) {
        if (v[docPos.r - i]) {
          var row = v[docPos.r - i];
          var colFound = -1;
          for(var j=0; j<row.length; j++) if(String(row[j]).toUpperCase().trim() === "TANGGAL") { colFound = j; break; }
          if (colFound >= 0) {
            dashData.sesuaiDocKas1 = extractTableAdaptive(v, docPos.r - i, colFound, "UP");
            break;
          }
        }
      }
    }
    
    var depLists = extractMultiLists(v, ["DEPOSIT", "DEPO"]);
    dashData.depositBank = depLists[0] || [];
    dashData.depositWallet = depLists[1] || [];
    
    var wdLists = extractMultiLists(v, ["WITHDRAW", "WD"]);
    dashData.withdraw = wdLists[0] || [];
    
    var penLists = extractMultiLists(v, ["PENDINGAN", "PENDING"]);
    dashData.pendinganBank = penLists[0] || [];
    dashData.pendinganWallet = penLists[1] || [];

    // Simpan ke cache selama 10 menit (600 detik)
    try { cache.put("KAS_DASH_DATA", JSON.stringify(dashData), 600); } catch(e) {}
  }

  // Gabungkan data aktif dengan data dashboard
  for (var key in dashData) { out.data[key] = dashData[key]; }

  // Khusus Saldo Depo/Wd/Ewallet (Selalu segar karena bagian bawah dashboard)
  var refreshSheet = (activeTabName === "DASHBOARD") ? values : (dashSheet ? dashSheet.getRange(1, 1, 200, 30).getDisplayValues() : values);
  out.data.saldoDepo = extractAllLists(refreshSheet, ["SALDO DEPO"]);
  out.data.saldoWd = extractAllLists(refreshSheet, ["SALDO WD"]);
  out.data.saldoEwallet = extractAllLists(refreshSheet, ["SALDO EWALLET", "E-WALLET"]);

  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function extractTableAdaptive(values, headerRowIdx, startCol, direction) {
  var headerRow = values[headerRowIdx];
  var endCol = startCol;
  for (var i = startCol; i < Math.min(startCol + 15, headerRow.length); i++) {
    var cell = String(headerRow[i] || '').toUpperCase();
    if (cell !== "") endCol = i;
    if (cell.indexOf("SALDO BANK") >= 0) { endCol = i; break; }
  }
  var headers = headerRow.slice(startCol, endCol + 1);
  var rows = [];
  var step = direction === "UP" ? -1 : 1;
  
  for (var i = 1; i <= 3; i++) {
    var r = headerRowIdx + (i * step);
    if (r < 0 || r >= values.length) break;
    var rowData = values[r].slice(startCol, endCol + 1);
    
    // Validasi row: harus ada isi dan bukan judul/banner
    var lineTxt = rowData.join("|").toUpperCase();
    if (lineTxt.trim() === "" || lineTxt.indexOf("KAS 1") >= 0 || lineTxt.indexOf("STATUS") >= 0) break;
    if (rowData.some(cell => String(cell).trim() !== "")) {
      rows.push(rowData);
    }
  }
  return { headers: headers, rows: rows };
}

function extractMultiLists(values, keywords) {
  var results = [];
  for (var r = 0; r < values.length; r++) {
    for (var c = 0; c < values[r].length; c++) {
      var cell = String(values[r][c] || '').toUpperCase().trim();
      if (keywords.some(k => cell === k)) {
        var group = [];
        for (var i = 1; i <= 60; i++) {
          if (r + i >= values.length) break;
          var L = String(values[r + i][c] || '').trim();
          var V = values[r + i][c + 1];
          if (!L && !String(V || '').trim()) { if (i > 3) break; continue; }
          var check = L.toUpperCase();
          if (["TANGGAL", "REAL TIME", "BALANCE", "STATUS", "WITHDRAW", "PENDINGAN", "DEPOSIT"].some(h => check === h)) break;
          if (L) group.push({ label: L, value: V });
        }
        if (group.length > 0) results.push(group);
      }
    }
  }
  return results;
}

function extractAllLists(values, keywords) {
  var res = [];
  for (var r = 0; r < values.length; r++) {
    for (var c = 0; c < values[r].length; c++) {
      var cell = String(values[r][c] || '').toUpperCase().trim();
      if (keywords.some(k => cell === k)) {
        for (var i = 1; i <= 60; i++) {
          if (r + i >= values.length) break;
          var L = String(values[r + i][c] || '').trim();
          var V = values[r + i][c + 1];
          if (!L && !String(V || '').trim()) { if (i > 3) break; continue; }
          var L_UP = L.toUpperCase();
          if (["TANGGAL", "REAL TIME", "BALANCE", "STATUS", "WITHDRAW", "PENDINGAN", "DEPOSIT"].some(h => L_UP === h)) break;
          if (L) res.push({ label: L, value: V });
        }
      }
    }
  }
  return res;
}

function findValueNearby(values, r, c) {
  for (var i = 1; i < 15; i++) {
    var raw = values[r][c + i];
    if (String(raw || '').trim() !== '') return raw;
  }
  return "-";
}
