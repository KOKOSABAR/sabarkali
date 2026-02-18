/**
 * Infinity Hub Cloud v4.7 - Premium Layout & Date Formatting
 */

let WEB_APP_URL = localStorage.getItem('cfg_web_app_url') || 'https://script.google.com/macros/s/AKfycbxvhEWyknsOnCzvfwuFtA2Z9-v1u00D34Sruwt4fyAVJvhzHt0yRJkc0UN6GHy1PzgP/exec';
// URL deployment CodeKas (spreadsheet Kas terpisah). Jika diisi, section Kas memakai URL ini.
let KAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxM4lvQX9udYswhc7ONJzAMLCgC0ckfmEWuNbwTzoeFvZ7P1rpotmRRMrMeXkvwjarX/exec';

const REKENING_API_URL = 'https://script.google.com/macros/s/AKfycbyyfs13PWqUdeBg5yWg4Km4_q-_QhnuNFBV-Upq-K6HzMRvi900jTwg3UG6rvLY4lbY/exec';

let allNotes = [];
let currentCategory = 'all';

// --- Global DOM ---
const extensionGrid = document.getElementById('extension-grid');
const notesGrid = document.getElementById('notes-grid');
const noteModal = document.getElementById('note-modal');
const confirmModal = document.getElementById('confirm-modal');
const categoryPills = document.getElementById('category-pills');
const categoryList = document.getElementById('category-list');
const toastContainer = document.getElementById('toast-container');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    updateClock();
    setInterval(updateClock, 1000);
    setupNavigation();

    // Only fetch if authenticated
    if (localStorage.getItem('auth_success') === 'true' && WEB_APP_URL) {
        fetchNotes();
        fetchExtensions();
        fetchKasDashboard();
    }
    if (typeof setupKasTabs === 'function') setupKasTabs();
    initRekeningChecker();

});



function initAuth() {
    const isAuth = localStorage.getItem('auth_success');
    if (isAuth === 'true') {
        document.body.classList.remove('login-pending');
    } else {
        document.body.classList.add('login-pending');
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
}

function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('login-username').value;
    const pass = document.getElementById('login-password').value;

    const VALID_USER = '@sabar';
    const VALID_PASS = '@Aa291217@';

    if (user === VALID_USER && pass === VALID_PASS) {
        localStorage.setItem('auth_success', 'true');
        document.body.classList.remove('login-pending');
        showToast('Access Granted. Welcome Sabar!', 'success');

        // Load data after successful login
        if (WEB_APP_URL) {
            fetchNotes();
            fetchExtensions();
        }
    } else {
        showToast('Authentication Failed. Invalid Credential.', 'error');
        // Clear inputs on failure
        document.getElementById('login-password').value = '';
    }
}


function handleLogout() {
    openConfirm('Logout', 'Are you sure you want to exit the dashboard?', () => {
        localStorage.removeItem('auth_success');
        location.reload();
    });
}

// --- UI Utilities ---
function toggleExpand(el, e) {
    e.stopPropagation();
    const isExpanded = el.classList.contains('expanded');
    document.querySelectorAll('.card.expanded').forEach(c => c.classList.remove('expanded'));
    if (!isExpanded) el.classList.add('expanded');
}

// Close expanded card on background click
document.addEventListener('click', (e) => {
    if (!e.target.closest('.card.expanded')) {
        document.querySelectorAll('.card.expanded').forEach(c => c.classList.remove('expanded'));
    }
});

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'check-circle' : (type === 'error' ? 'exclamation-circle' : 'info-circle');
    toast.innerHTML = `<i class="fas fa-${icon}"></i> <span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

function openConfirm(title, message, onConfirm) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    confirmModal.classList.add('active');

    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');

    const cleanup = () => {
        confirmModal.classList.remove('active');
        okBtn.onclick = null;
        cancelBtn.onclick = null;
    };

    okBtn.onclick = () => { onConfirm(); cleanup(); };
    cancelBtn.onclick = cleanup;
}

function formatDate(dateStr) {
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) { return dateStr; }
}

// --- Note Management ---
async function fetchNotes() {
    if (!WEB_APP_URL) return;
    try {
        const resp = await fetch(`${WEB_APP_URL}?action=getNotes`);
        const json = await resp.json();
        if (json.success) {
            allNotes = json.data;
            renderNotes();
            updateCategoryList();
        }
    } catch (e) {
        console.error('Note fetch error', e);
        showToast('Failed to fetch notes', 'error');
    }
}

function renderNotes() {
    const notesContainer = document.getElementById('notes-grid');
    if (!notesContainer) return; // Note grid might not exist yet if tab is not active

    notesContainer.innerHTML = '';
    const filtered = currentCategory === 'all' ? allNotes : allNotes.filter(n => n.category === currentCategory);

    if (filtered.length === 0) {
        notesContainer.innerHTML = '<div class="loading-state"><i class="fas fa-folder-open"></i><p>No notes found in this category.</p></div>';
        return;
    }

    [...filtered].reverse().forEach((note, index) => {
        const cardWrapper = document.createElement('div');
        const themeClass = `card-theme-${Math.floor(Math.random() * 6) + 1}`;
        cardWrapper.className = `card entry-anim ${themeClass}`; // Add random theme
        cardWrapper.style.animationDelay = `${index * 0.05}s`;

        // Double click to VIEW NOTE in big modal
        cardWrapper.ondblclick = (e) => {
            openViewNoteModal(note);
        };

        const shortContent = note.content.length > 200 ? note.content.substring(0, 200) + '...' : note.content;

        // New Flip Card Structure for Notes
        // Front: Title, Preview, Badge
        // Back: Actions (Edit, Delete, Copy)
        cardWrapper.innerHTML = `
          <div class="content">
            <div class="front">
              <div class="front-content">
                <div class="badge" style="background: var(--card-accent, var(--primary)); color: #fff; font-weight:800; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">${note.category || 'NOTE'}</div>
                <div class="description" style="flex-grow:1; display:flex; flex-direction:column; justify-content:center; align-items:center; background:none; backdrop-filter:none; box-shadow:none;">
                  <div class="title" style="width:100%; text-align:center; padding: 0 10px;">
                    <p class="title" style="font-size: 1.2rem; font-weight:800; text-transform:uppercase; text-shadow: 0 2px 10px rgba(0,0,0,0.8);">
                      ${note.title || 'Untitled'}
                    </p>
                  </div>
                </div>
                
                <div class="description" style="margin-top:auto;">
                  <div class="content-text" style="font-size:10px; opacity:0.8; max-height: 40px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${shortContent}
                  </div>
                  <p class="card-footer" style="margin-top:5px;">
                    ${formatDate(note.date)}
                  </p>
                </div>
              </div>
              
              <!-- Decorative Background Circles in Front -->
              <div class="img">
                  <div class="circle circle-bottom"></div>
                  <div class="circle circle-right"></div>
              </div>
            </div>
            
            <div class="back">
              <div class="back-content">
                <strong>${note.title || 'Untitled'}</strong>
                <div style="display:flex; gap:10px;">
                    <button class="btn" style="padding:5px 12px; font-size:0.75rem;" onclick="copyNote('${note.id}')">Copy</button>
                    <button class="btn" style="padding:5px 12px; font-size:0.75rem;" onclick="editNote('${note.id}')">Edit</button>
                    <button class="btn" style="padding:5px 12px; font-size:0.75rem; border-color:#ff4757; color:#ff4757;" onclick="deleteNote('${note.id}')">Delete</button>
                </div>
              </div>
            </div>
          </div>
        `;
        notesContainer.appendChild(cardWrapper);
    });
}

function openViewNoteModal(note) {
    const modal = document.getElementById('view-note-modal');
    if (!modal) return;

    document.getElementById('view-note-title').textContent = note.title || 'Untitled';
    document.getElementById('view-note-category').textContent = note.category || 'NOTE';
    document.getElementById('view-note-content').textContent = note.content || '';
    document.getElementById('view-note-date').textContent = `Last updated: ${formatDate(note.date)}`;

    // Close button logic
    const closeBtn = document.getElementById('close-view-note');
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.classList.remove('active');
            modal.style.opacity = 0;
            setTimeout(() => modal.style.display = 'none', 300); // Wait for transition
        };
    }

    // Button Actions
    const copyBtn = document.getElementById('view-note-copy');
    if (copyBtn) {
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(note.content).then(() => {
                showToast('Content copied to clipboard', 'success');
            }).catch(() => showToast('Failed to copy', 'error'));
        };
    }

    const editBtn = document.getElementById('view-note-edit');
    if (editBtn) {
        editBtn.onclick = () => {
            // Close view modal first
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
                // Trigger edit mode
                editNote(note.id);
            }, 300);
        };
    }

    const deleteBtn = document.getElementById('view-note-delete');
    if (deleteBtn) {
        deleteBtn.onclick = () => {
            // Close view modal first
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
                // Trigger delete confirmation
                deleteNote(note.id);
            }, 300);
        };
    }

    // Show modal
    modal.style.display = 'flex';
    // Small delay to allow display:flex to apply before transition
    setTimeout(() => {
        modal.classList.add('active');
        modal.style.opacity = 1;
    }, 10);
}

function updateCategoryList() {
    const categories = [...new Set(allNotes.map(n => n.category).filter(c => c))];
    categoryPills.innerHTML = '';

    // "All" pill
    const allPill = document.createElement('div');
    allPill.className = `pill ${currentCategory === 'all' ? 'active' : ''}`;
    allPill.textContent = 'All Notes';
    allPill.onclick = () => {
        currentCategory = 'all';
        renderNotes();
        updateCategoryList();
    };
    categoryPills.appendChild(allPill);

    categories.forEach(cat => {
        const pill = document.createElement('div');
        pill.className = `pill ${currentCategory === cat ? 'active' : ''}`;
        pill.textContent = cat;
        pill.onclick = () => {
            currentCategory = cat;
            renderNotes();
            updateCategoryList();
        };
        categoryPills.appendChild(pill);
    });

    categoryList.innerHTML = '';
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        categoryList.appendChild(opt);
    });
}

document.getElementById('note-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('save-note-btn');
    const label = btn.querySelector('strong') || btn; // Resilient to missing strong tag
    btn.disabled = true;
    const oldText = label.textContent;
    label.textContent = 'SAVING...';

    const payload = {
        action: 'saveNote',
        id: document.getElementById('note-id').value || null,
        category: document.getElementById('note-category').value,
        title: document.getElementById('note-title').value,
        content: document.getElementById('note-content').value
    };

    try {
        const resp = await fetch(WEB_APP_URL, { method: 'POST', body: JSON.stringify(payload) });
        const res = await resp.json();
        if (res.success) {
            showToast('Note saved successfully!', 'success');
            noteModal.classList.remove('active');
            fetchNotes();
        }
    } catch (e) {
        showToast('Server error', 'error');
        console.error(e);
    }

    btn.disabled = false;
    label.textContent = oldText || 'SAVE NOTE';
});

window.editNote = (id) => {
    const note = allNotes.find(n => n.id == id);
    if (!note) return;
    document.getElementById('note-modal-title').textContent = 'Edit Note';
    document.getElementById('note-id').value = note.id;
    document.getElementById('note-category').value = note.category;
    document.getElementById('note-title').value = note.title;
    document.getElementById('note-content').value = note.content;
    noteModal.classList.add('active');
};

window.copyNote = (id) => {
    const note = allNotes.find(n => n.id == id);
    if (!note) return;
    const text = `[${note.category}] ${note.title}\n\n${note.content}`;
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!', 'info'));
};

window.deleteNote = (id) => {
    openConfirm('Delete Note?', 'This note will be permanently removed.', async () => {
        try {
            const resp = await fetch(WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'deleteNote', id: id }) });
            const res = await resp.json();
            if (res.success) {
                showToast('Note deleted', 'success');
                fetchNotes();
            }
        } catch (e) { showToast('Delete failed', 'error'); }
    });
};

// --- Extension Management ---
async function fetchExtensions() {
    if (!WEB_APP_URL) return;
    try {
        const response = await fetch(`${WEB_APP_URL}?action=getExtensions`);
        const json = await response.json();
        if (json.success) {
            const files = json.data;
            extensionGrid.innerHTML = '';
            if (!files || files.length === 0) {
                extensionGrid.innerHTML = '<div class="loading-state"><i class="fas fa-folder-open"></i><p>No files found.</p></div>';
                return;
            }
            files.forEach((f, idx) => {
                const accentIndex = (idx % 6) + 1;
                const isZip = f.name.toLowerCase().endsWith('.zip');
                const icon = isZip ? 'fa-file-zipper' : 'fa-file-code';
                const card = document.createElement('div');
                const themeClass = `card-theme-${Math.floor(Math.random() * 6) + 1}`;
                card.className = `card ${themeClass}`; // Add random theme
                card.style.animationDelay = `${idx * 0.05}s`;
                // Double click to download (or keep existing logic)
                card.ondblclick = (e) => {
                    window.open(`https://drive.google.com/uc?export=download&id=${f.id}`, '_blank');
                };

                // New Flip Card Structure
                card.innerHTML = `
                  <div class="content">
                    <div class="front">
                      <div class="front-content">
                        <div class="badge">${isZip ? 'ZIP' : 'FILE'}</div>
                        <div class="description">
                          <div class="title">
                            <p class="title">
                              <strong>${f.name}</strong>
                            </p>
                            <svg fill-rule="nonzero" height="15px" width="15px" viewBox="0,0,256,256" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg"><g style="mix-blend-mode: normal" text-anchor="none" font-size="none" font-weight="none" font-family="none" stroke-dashoffset="0" stroke-dasharray="" stroke-miterlimit="10" stroke-linejoin="miter" stroke-linecap="butt" stroke-width="1" stroke="none" fill-rule="nonzero" fill="#20c997"><g transform="scale(8,8)"><path d="M25,27l-9,-6.75l-9,6.75v-23h18z"></path></g></g></svg>
                          </div>
                          <p class="card-footer">
                            ${(f.size / 1024 / 1024).toFixed(2)} MB &nbsp; | &nbsp; ${f.description || 'No Desc'}
                          </p>
                        </div>
                      </div>
                      
                      <!-- Decorative Background Circles in Front -->
                      <div class="img">
                          <div class="circle circle-bottom"></div>
                          <div class="circle circle-right"></div>
                      </div>
                    </div>
                    
                    <div class="back">
                      <div class="back-content">
                        <i class="fas ${icon} fa-3x"></i>
                        <strong>${f.name}</strong>
                        <a href="https://drive.google.com/uc?export=download&id=${f.id}" target="_blank" class="btn" style="width:auto; height:auto; padding:5px 15px; font-size:0.75rem;">
                             Download
                        </a>
                      </div>
                    </div>
                  </div>
                `;
                extensionGrid.appendChild(card);
            });
        }
    } catch (e) { console.error(e); }
}

let kasActiveTab = 'DASHBOARD';
function getKasActiveTab() {
    return kasActiveTab;
}

window.switchKasTo = (tab) => {
    kasActiveTab = tab;

    // Update active UI state for buttons in header actions
    const container = document.getElementById('kas-header-actions');
    if (container) {
        container.querySelectorAll('.btn').forEach(btn => {
            if (btn.textContent.trim().toUpperCase() === tab.toUpperCase()) {
                btn.style.background = 'var(--primary)';
                btn.style.color = '#000';
                btn.style.fontWeight = '700';
            } else if (btn.textContent.trim().toUpperCase() !== 'REFRESH') {
                btn.style.background = 'rgba(255,255,255,0.1)';
                btn.style.color = '#fff';
                btn.style.fontWeight = '400';
            }
        });
    }

    fetchKasDashboard();
};

async function fetchKasDashboard(isRefresh = false) {
    // Gunakan URL terbaru yang Anda berikan
    const baseUrl = KAS_WEB_APP_URL;
    if (!baseUrl) return;
    const tab = getKasActiveTab();
    const btn = document.getElementById('kas-refresh-btn');
    const btnTop = document.getElementById('kas-refresh-btn-top');
    const btnHeader = document.querySelector('#kas-header-actions .btn');
    const loadingHtml = '<i class="fas fa-spinner fa-spin"></i> SYNCING...';

    if (btn) { btn.disabled = true; btn.innerHTML = loadingHtml; }
    if (btnTop) { btnTop.disabled = true; btnTop.innerHTML = loadingHtml; }
    if (btnHeader) { btnHeader.disabled = true; btnHeader.innerHTML = loadingHtml; }
    try {
        const url = `${baseUrl}?action=getKasDashboard&tab=${encodeURIComponent(tab)}&refresh=${isRefresh}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
        const json = await resp.json();
        if (json.debug) console.log('Kas Debug Info:', json.debug);

        const hasData = json.data && (
            (json.data.realTimeKas1.headers || []).length > 0 ||
            (json.data.sesuaiDocKas1.headers || []).length > 0 ||
            Object.keys(json.data.balance || {}).length > 0
        );

        if (json.success && json.data && hasData) {
            renderKasDashboard(json.data);
            if (btn) showToast('Data Kas diperbarui', 'success');
        } else {
            const errMsg = json.error || 'Data ditemukan 0 baris (Cek Layout Sheet)';
            showToast('Kas Debug: ' + errMsg, 'warning');
            renderKasDashboard(json.data || null);
            if (json.debug) {
                console.warn('DIAGNOSTIK:', json.debug);
                alert('DIAGNOSA KONEKSI:\n- File: ' + json.debug.spreadsheetName + '\n- Baris dibaca: ' + json.debug.dataRowsRead + '\n- Seksi ditemukan: ' + (json.debug.rtKasFound ? 'RealTime ' : '') + (json.debug.docKasFound ? 'Doc ' : '') + (json.debug.balanceFound ? 'Balance' : 'None') + '\n\nPastikan ID Spreadsheet di CodeKas.gs baris 14 sudah benar!');
            }
        }
    } catch (e) {
        console.error('Kas fetch error', e);
        // Pesan error lebih detail untuk debugging
        showToast('Gagal memuat data: ' + e.message, 'error');
        renderKasDashboard(null);
    }
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync-alt"></i> REFRESH KAS'; }
    if (btnTop) { btnTop.disabled = false; btnTop.innerHTML = '<i class="fas fa-sync-alt"></i> SYNC SHEET'; }
    if (btnHeader) { btnHeader.disabled = false; btnHeader.innerHTML = '<i class="fas fa-sync-alt"></i> REFRESH DATA KAS'; }
}

function renderKasDashboard(data) {
    const fmt = (v) => (v === undefined || v === null || v === '') ? '-' : String(v);
    const fmtNum = (v) => {
        if (v === undefined || v === null || v === '') return '-';
        let val = String(v).trim();

        // Cek jika angka negatif (dalam kurung misal (1.000) atau dengan tanda minus -1.000)
        // Regex ini menangkap angka di dalam kurung dan menganggapnya negatif
        const isNeg = val.startsWith('-') || /^\(.*\)$/.test(val);

        // Bersihkan semua karakter kecuali digit dan simpan satu tanda minus jika isNeg true
        let numStr = val.replace(/[^\d]/g, ''); // Hapus semua non-digit (termasuk titik/koma pemisah ribuan)
        let num = parseFloat(numStr);

        if (!isNaN(num)) {
            if (isNeg) num = -num;
            // Format IDR yang cantik
            const formatted = new Intl.NumberFormat('id-ID').format(Math.abs(num));
            const result = num < 0 ? `(${formatted})` : formatted;
            const color = num < 0 ? '#ff4757' : 'inherit';
            return `<span style="color: ${color}; font-weight: ${num < 0 ? '700' : 'inherit'}">${result}</span>`;
        }
        return val;
    };

    if (!data) {
        document.getElementById('kas-realtime-thead').innerHTML = '<tr><td colspan="10">Isi Sheet Kas di Google Sheet lalu klik REFRESH KAS</td></tr>';
        document.getElementById('kas-realtime-tbody').innerHTML = '';
        document.getElementById('kas-realtime-balance').textContent = '-';
        document.getElementById('kas-balance-kas1').textContent = '-';
        document.getElementById('kas-doc-thead').innerHTML = '';
        document.getElementById('kas-doc-tbody').innerHTML = '';
        ['kas-deposit-list', 'kas-withdraw-list', 'kas-pendingan-list', 'kas-saldo-depo-list', 'kas-saldo-wd-list', 'kas-saldo-ewallet-list'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<li class="kas-list-empty">Data dari Sheet</li>';
        });
        var tab = getKasActiveTab();
        var sheetTitle = document.getElementById('kas-sheet-panel-title');
        if (sheetTitle) sheetTitle.textContent = 'Data: ' + tab;
        document.getElementById('kas-sheet-thead').innerHTML = '<tr><th>Kolom</th></tr>';
        document.getElementById('kas-sheet-tbody').innerHTML = '<tr><td>Buat sheet "' + tab + '" di Google Sheet lalu REFRESH KAS</td></tr>';
        return;
    }

    const rt = data.realTimeKas1 || {};
    const theadRt = document.getElementById('kas-realtime-thead');
    const tbodyRt = document.getElementById('kas-realtime-tbody');
    if (rt.headers && rt.headers.length) {
        theadRt.innerHTML = '<tr>' + rt.headers.map(h => '<th>' + fmt(h) + '</th>').join('') + '</tr>';
        tbodyRt.innerHTML = (rt.rows || []).map(row =>
            '<tr>' + row.map((c, idx) => '<td>' + (idx === 0 ? fmt(c) : fmtNum(c)) + '</td>').join('') + '</tr>'
        ).join('') || '<tr><td colspan="' + rt.headers.length + '">-</td></tr>';
    } else {
        theadRt.innerHTML = '<tr><th>TANGGAL</th><th>SALDO AWAL</th><th>HASIL DEPOSIT</th><th>SALDO AKHIR</th><th>SALDO BANK</th></tr>';
        tbodyRt.innerHTML = '<tr><td colspan="5">Tambah sheet "KasRealTime" di Google Sheet</td></tr>';
    }

    const parseVal = (v) => {
        if (!v) return 0;
        let val = String(v).trim();
        const isNeg = val.startsWith('-') || /^\(.*\)$/.test(val);
        let numStr = val.replace(/[^\d]/g, '');
        let num = parseFloat(numStr) || 0;
        return isNeg ? -num : num;
    };

    const bal = data.balance || {};
    const rbEl = document.getElementById('kas-realtime-balance');
    const b1El = document.getElementById('kas-balance-kas1');
    const selEl = document.getElementById('kas-selisih-balance');

    const v1Raw = bal['REAL TIME BALANCE'] ?? bal['REAL TIME BALANCE '] ?? bal['Real Time Balance'];
    const v2Raw = bal['BALANCE KAS 1'] ?? bal['Balance Kas 1'];

    if (rbEl) rbEl.innerHTML = fmtNum(v1Raw) || '-';
    if (b1El) b1El.innerHTML = fmtNum(v2Raw) || '-';

    if (selEl) {
        const val1 = parseVal(v1Raw);
        const val2 = parseVal(v2Raw);
        const selisih = val1 - val2;
        selEl.innerHTML = fmtNum(selisih);
        // Sesuaikan warna selisih: hijau jika 0, merah jika tidak 0 (asumsi selisih adalah error)
        selEl.style.color = selisih === 0 ? '#00ff75' : '#ff4757';
    }

    const doc = data.sesuaiDocKas1 || {};
    const theadDoc = document.getElementById('kas-doc-thead');
    const tbodyDoc = document.getElementById('kas-doc-tbody');
    if (doc.headers && doc.headers.length) {
        theadDoc.innerHTML = '<tr>' + doc.headers.map(h => '<th>' + fmt(h) + '</th>').join('') + '</tr>';
        tbodyDoc.innerHTML = (doc.rows || []).map(row =>
            '<tr>' + row.map((c, idx) => '<td>' + (idx === 0 ? fmt(c) : fmtNum(c)) + '</td>').join('') + '</tr>'
        ).join('') || '<tr><td colspan="' + doc.headers.length + '">-</td></tr>';
    } else {
        theadDoc.innerHTML = '';
        tbodyDoc.innerHTML = '<tr><td>Tambah sheet "KasDoc" di Google Sheet</td></tr>';
    }

    // Ekstrak Crosscheck (Status & Labels)
    const cc = data.crosscheck || {};
    const theadCc = document.getElementById('kas-crosscheck-thead');
    const tbodyCc = document.getElementById('kas-crosscheck-tbody');
    const panelCc = document.getElementById('kas-crosscheck-panel');

    if (cc.labels && cc.labels.length && cc.status && cc.status.length) {
        if (panelCc) panelCc.style.display = 'block';
        theadCc.innerHTML = '<tr><th>STATUS (DIFF)</th>' + cc.labels.map(h => '<th>' + fmt(h) + '</th>').join('') + '</tr>';

        tbodyCc.innerHTML = '<tr><td style="font-weight:bold; color:#ffcc00;">HASIL SELISIH</td>' +
            cc.status.map(val => {
                // Beri warna khusus untuk hasil selisih
                let valStr = String(val);
                let isNeg = valStr.startsWith('-') || valStr.includes('(');
                let isZero = valStr.trim() === '0' || valStr.trim() === '(0)';
                let color = isZero ? '#00ff75' : (isNeg ? '#ff4757' : '#00ff75');
                return `<td style="color:${color}; font-weight:800;">${fmtNum(val)}</td>`;
            }).join('') + '</tr>';
    } else {
        if (panelCc) panelCc.style.display = 'none';
    }

    function fillList(id, arr) {
        const el = document.getElementById(id);
        if (!el) return;
        if (!arr || !arr.length) { el.innerHTML = '<li class="kas-list-empty">-</li>'; return; }
        el.innerHTML = arr.map(x => '<li><span class="kas-list-label">' + fmt(x.label) + '</span><span class="kas-list-value">' + fmtNum(x.value) + '</span></li>').join('');
    }
    fillList('kas-deposit-list', data.depositBank || data.deposit);
    fillList('kas-deposit-wallet-list', data.depositWallet);
    fillList('kas-withdraw-list', data.withdraw);
    fillList('kas-pendingan-list', data.pendinganBank || data.pendingan);
    fillList('kas-pendingan-wallet-list', data.pendinganWallet);
    fillList('kas-saldo-depo-list', data.saldoDepo);
    fillList('kas-saldo-wd-list', data.saldoWd);
    fillList('kas-saldo-ewallet-list', data.saldoEwallet);

    const activeTab = data.activeSheetTab || getKasActiveTab();
    const sheetTable = data.sheetTable || {};
    const dashboardGrid = document.querySelector('.kas-grid-dashboard');
    const sheetPanel = document.getElementById('kas-sheet-panel');
    const summaryEl = document.getElementById('kas-allsaldo-summary');

    if (sheetTitle) sheetTitle.textContent = 'Data: ' + activeTab;

    // TAMPILKAN GRID HANYA DI TAB DASHBOARD
    if (activeTab === 'DASHBOARD') {
        if (dashboardGrid) dashboardGrid.style.display = 'grid';
        if (sheetPanel) sheetPanel.style.display = 'none';
        if (summaryEl) summaryEl.style.display = 'none';
    } else {
        if (dashboardGrid) dashboardGrid.style.display = 'none';
        if (sheetPanel) sheetPanel.style.display = 'block';

        // Tampilkan ringkasan (kartu) terutama untuk ALL SALDO
        if (summaryEl) {
            if (sheetTable.summary && Object.keys(sheetTable.summary).length > 0) {
                var keys = Object.keys(sheetTable.summary);
                var cards = keys.map(function (k) {
                    var v = sheetTable.summary[k];
                    var val = (v === undefined || v === null) ? '-' : String(v);
                    // Gunakan fmtNum untuk konsistensi warna
                    return '<div class="kas-summary-card"><span class="kas-summary-label">' + fmt(k) + '</span><span class="kas-summary-value">' + fmtNum(val) + '</span></div>';
                });
                summaryEl.innerHTML = '<div class="kas-summary-row">' + cards.join('') + '</div>';
                summaryEl.style.display = '';
            } else {
                summaryEl.innerHTML = '';
                summaryEl.style.display = 'none';
            }
        }
    }

    // Tampilkan data TABEL UTAMA (Selama bukan Dashboard)
    var sheetThead = document.getElementById('kas-sheet-thead');
    var sheetTbody = document.getElementById('kas-sheet-tbody');
    var sheetContainer = document.querySelector('.kas-sheet-table-wrapper');
    if (!sheetContainer) return;

    // JIKA ADA BLOCKS (Format ALL SALDO Horizontal)
    const blocksContainer = document.getElementById('kas-blocks-container');
    if (sheetTable.blocks && sheetTable.blocks.length > 0) {
        let html = '';
        sheetTable.blocks.forEach(block => {
            html += `<div class="kas-horizontal-block" style="margin-bottom: 25px; border-radius: 12px; overflow: hidden; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);">
                <div style="padding: 12px 20px; background: rgba(255,255,255,0.05); font-weight: 800; color: var(--primary); border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 0.95rem;">
                    ${block.title}
                </div>
                <div style="overflow-x: auto; padding: 10px;">
                    <table class="kas-table" style="width: auto; min-width: 350px; border-collapse: collapse; margin-bottom: 5px;">
                        <thead>
                            <tr style="background: rgba(0,0,0,0.3);">
                                <th style="width: 80px; text-align: center; color: #888; font-size: 0.7rem; border-right: 1px solid rgba(255,255,255,0.05);">LABEL</th>
                                ${block.headers.map(h => `<th style="min-width: 150px; text-align: center; color: #fff; font-size: 0.7rem; padding: 10px; line-height: 1.3;">${h}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="text-align: center; font-weight: bold; background: #fbbf24; color: #000; font-size: 0.75rem; border-right: 1px solid rgba(255,255,255,0.05);">DOC</td>
                                ${block.doc.map(v => `<td style="text-align: center; font-weight: 600; font-size: 0.85rem;">${fmtNum(v)}</td>`).join('')}
                            </tr>
                            <tr>
                                <td style="text-align: center; font-weight: bold; background: #34d399; color: #000; font-size: 0.75rem; border-right: 1px solid rgba(255,255,255,0.05);">KAS</td>
                                ${block.kas.map(v => `<td style="text-align: center; font-weight: 600; font-size: 0.85rem;">${fmtNum(v)}</td>`).join('')}
                            </tr>
                            <tr style="border-top: 1px solid rgba(255,255,255,0.2);">
                                <td style="text-align: center; font-weight: bold; background: #6b7280; color: #fff; font-size: 0.75rem; border-right: 1px solid rgba(255,255,255,0.05);">HASIL</td>
                                ${block.hasil.map(v => {
                const numStr = String(v || "0").replace(/[^0-9.-]/g, '');
                const num = parseFloat(numStr) || 0;
                const isZero = (num === 0);
                const bgColor = isZero ? 'rgba(52, 211, 153, 0.2)' : 'rgba(239, 68, 68, 0.2)';
                const textColor = isZero ? '#34d399' : '#f87171';
                return `<td style="text-align: center; font-weight: 800; font-size: 0.85rem; color: ${textColor}; background: ${bgColor};">${fmtNum(v)}</td>`;
            }).join('')}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>`;
        });

        if (blocksContainer) {
            blocksContainer.innerHTML = html;
            blocksContainer.style.display = 'block';
        }
        sheetContainer.style.display = 'none'; // Sembunyikan tabel standar
        return;
    }

    // Reset container blocks jika tab lain
    if (blocksContainer) {
        blocksContainer.innerHTML = '';
        blocksContainer.style.display = 'none';
    }
    sheetContainer.style.display = 'block';

    if (sheetTable.headers && sheetTable.headers.length) {
        // Filter Kolom Kosong: Hanya tampilkan kolom yang memiliki data di minimal satu baris
        const validColIndices = sheetTable.headers.map((h, idx) => {
            // Cek apakah header atau salah satu cell di kolom ini ada isinya
            const hasHeader = h && String(h).trim() !== '';
            const hasData = (sheetTable.rows || []).some(row => row[idx] && String(row[idx]).trim() !== '' && String(row[idx]).trim() !== '-');
            return (hasHeader || hasData) ? idx : -1;
        }).filter(idx => idx !== -1);

        if (validColIndices.length > 0) {
            sheetThead.innerHTML = '<tr>' + validColIndices.map(idx => '<th>' + fmt(sheetTable.headers[idx]) + '</th>').join('') + '</tr>';
            sheetTbody.innerHTML = (sheetTable.rows || []).map(row => {
                // Cek apakah baris ini benar-benar kosong setelah difilter
                const hasValue = validColIndices.some(idx => row[idx] && String(row[idx]).trim() !== '' && String(row[idx]).trim() !== '-');
                if (!hasValue) return ''; // Skip baris kosong
                return '<tr>' + validColIndices.map(idx => '<td>' + fmtNum(row[idx]) + '</td>').join('') + '</tr>';
            }).join('') || '<tr><td colspan="' + validColIndices.length + '">Tidak ada data transaksi.</td></tr>';
        } else {
            sheetThead.innerHTML = '<tr><th>INFO</th></tr>';
            sheetTbody.innerHTML = '<tr><td>Sheet ini tidak memiliki data kolom yang valid.</td></tr>';
        }
    } else if (activeTab !== 'DASHBOARD') {
        sheetThead.innerHTML = '<tr><th>INFO</th></tr>';
        sheetTbody.innerHTML = '<tr><td>Data di sheet "' + activeTab + '" kosong atau belum terisi.</td></tr>';
    }
}

function setupKasTabs() {
    document.querySelectorAll('.kas-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.kas-tab').forEach(function (t) { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
            fetchKasDashboard();
        });
    });
}

document.getElementById('extension-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('upload-btn');
    const label = btn.querySelector('strong') || btn; // Resilient to missing strong tag
    const file = document.getElementById('ext-file').files[0];
    const name = document.getElementById('ext-name').value;

    if (!file) return showToast('Please select a file', 'error');
    btn.disabled = true;
    const oldText = label.textContent;
    label.textContent = 'UPLOADING...';

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        try {
            const base64 = reader.result.split(',')[1];
            const payload = {
                action: 'uploadExtension',
                fileName: name || file.name,
                base64: base64,
                description: 'Direct Hub Upload'
            };
            const resp = await fetch(WEB_APP_URL, { method: 'POST', body: JSON.stringify(payload) });
            const res = await resp.json();
            if (res.success) {
                showToast('Upload successful!', 'success');
                document.getElementById('extension-modal').classList.remove('active');
                fetchExtensions();
            } else {
                showToast(res.error || 'Upload failed', 'error');
            }
        } catch (e) {
            showToast('Server error', 'error');
            console.error(e);
        }
        btn.disabled = false;
        label.textContent = oldText || 'START UPLOAD';
    };
});



// --- Navigation ---
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section-content');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('data-target');

            // Reset active states
            navLinks.forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.nav-group').forEach(g => g.classList.remove('active'));

            link.classList.add('active');

            // Handle parent groups for sub-links
            const parentGroup = link.closest('.nav-group');
            if (parentGroup) parentGroup.classList.add('active');

            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(target).classList.add('active');
            document.getElementById('page-title').textContent = link.querySelector('span').textContent;
            document.getElementById('add-extension-btn').style.display = target === 'extensions-section' ? 'flex' : 'none';
            document.getElementById('notes-actions').style.display = target === 'notes-section' ? 'flex' : 'none';
            const kasHeaderActions = document.getElementById('kas-header-actions');
            if (kasHeaderActions) kasHeaderActions.style.display = target === 'kas-section' ? 'flex' : 'none';

            if (target === 'kas-section') fetchKasDashboard();
            if (target === 'galeri-section') fetchGallery();
            if (target === 'jadwal-bola-section') fetchFootballSchedule();

            if (target === 'togel-section') {
                const activeTab = document.querySelector('.tab-pill.active');
                if (activeTab) {
                    const tabIdMatch = /'(.+)'/.exec(activeTab.getAttribute('onclick'));
                    if (tabIdMatch) {
                        if (tabIdMatch[1] === 'live-togel') initLiveDraw();
                        if (tabIdMatch[1] === 'prediksi-togel') initPrediction();
                    }
                }
            }
        });
    });

    const kasRefreshBtn = document.getElementById('kas-refresh-btn');
    const kasRefreshBtnTop = document.getElementById('kas-refresh-btn-top');
    const kasHeaderBtn = document.querySelector('#kas-header-actions .btn');

    if (kasRefreshBtn) kasRefreshBtn.addEventListener('click', () => fetchKasDashboard(true)); // Manual Refresh = Force
    if (kasRefreshBtnTop) kasRefreshBtnTop.addEventListener('click', () => fetchKasDashboard(true));
    if (kasHeaderBtn) kasHeaderBtn.addEventListener('click', () => fetchKasDashboard(true));

    document.getElementById('add-note-btn').addEventListener('click', () => {
        document.getElementById('note-modal-title').textContent = 'New Note';
        document.getElementById('note-form').reset();
        document.getElementById('note-id').value = '';
        noteModal.classList.add('active');
    });

    document.getElementById('add-extension-btn').addEventListener('click', () => {
        document.getElementById('extension-form').reset();
        document.getElementById('extension-modal').classList.add('active');
    });

    document.querySelectorAll('.close-modal').forEach(c => c.onclick = () => document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')));
}

// --- Shortcut Category Switcher ---
window.switchShortcutCategory = (catId, btn) => {
    // Hide all contents
    document.querySelectorAll('.shortcut-cat-content').forEach(el => el.classList.remove('active'));
    // Show target content
    document.getElementById(`cat-${catId}`).classList.add('active');

    // Update button states
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    showToast(`Tool: ${catId.replace('-', ' ').toUpperCase()}`, 'info');
};

// --- Robot Shortcut Logic ---

function processRobotData(inputId, tbodyId, type) {
    const input = document.getElementById(inputId);
    const tbody = document.getElementById(tbodyId);
    if (!input || !tbody) return;

    input.addEventListener('input', function (e) {
        const lines = e.target.value.split('\n').filter(l => l.trim() !== '');
        tbody.innerHTML = '';

        lines.forEach((line, idx) => {
            // Split by TAB or multiple spaces
            const parts = line.split(/\t| {2,}/);
            if (parts.length >= 4) {
                // Input Format: [0]userid, [1]norek, [2]nama, [3]nominal, [4]null, [5]bank
                const userId = parts[0]?.trim();
                let rek = parts[1]?.trim();
                const nama = parts[2]?.trim();
                const nominal = parts[3]?.trim();
                const bank = parts[5]?.trim() || (type === 'bank' ? 'BANK' : 'E-WALLET');

                // Logic Khusus E-Wallet
                if (type === 'wallet') {
                    const bankUpper = bank.toUpperCase().replace(/\s/g, ''); // Remove spaces
                    if (bankUpper === 'GOPAY' && !rek.startsWith('70001')) {
                        rek = '70001' + rek;
                    } else if (bankUpper === 'DANA' && !rek.startsWith('3901')) {
                        rek = '3901' + rek;
                    } else if (bankUpper === 'OVO' && !rek.startsWith('39358')) {
                        rek = '39358' + rek;
                    } else if (bankUpper === 'LINKAJA' && !rek.startsWith('09110')) {
                        rek = '09110' + rek;
                    }
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${bank}</td>
                    <td>${rek}</td>
                    <td>${userId}</td>
                    <td>${nama}</td>
                    <td style="color:#00ff75; font-weight:800;">${nominal}</td>
                `;
                tbody.appendChild(tr);
            }
        });
    });
}

// --- Admin WD Shortcut Logic ---
window.processAdminWD = () => {
    const input = document.getElementById('admin-wd-input');
    const tbody = document.getElementById('admin-wd-body');
    if (!input || !tbody) return;

    const rawData = input.value.trim();
    if (!rawData) {
        tbody.innerHTML = '';
        return;
    }

    // Pembersihan data: Hapus kutipan dan normalkan baris
    const cleanData = rawData.replace(/"/g, '');

    // Split berdasarkan index angka di awal baris (1 tab, 2 tab, dst)
    const entries = cleanData.split(/\n(?=\s*\d+[\t\s]+)/);

    tbody.innerHTML = '';

    entries.forEach(entry => {
        if (!entry.trim()) return;

        // 1. Ekstrak User ID
        // Pola: cari kata pertama setelah angka index dan tab
        const userMatch = entry.match(/^\s*\d+[\t\s]+([^\n\t\s]+)/);
        const userId = userMatch ? userMatch[1].split('\n')[0] : 'N/A';

        // 2. Ekstrak Nominal WD
        // Mencari pola angka ribuan (e.g., 630,000 atau 1,000,000)
        // Kita ambil angka yang muncul setelah bagian tanggal atau yang memiliki format ribuan
        const allCurrencyNumbers = entry.match(/\d{1,3}(,\d{3})+/g);
        const nominal = allCurrencyNumbers ? allCurrencyNumbers[0] : '0';

        // 3. Ekstrak Data Bank dari bagian "To :"
        const toSectionMatch = entry.match(/To\s*:\s*([^"\n\r\t]+)/i);

        if (toSectionMatch) {
            const bankData = toSectionMatch[1].split(',').map(s => s.trim());

            if (bankData.length >= 3) {
                let bankName = bankData[0].toUpperCase().replace(/\s+/g, ''); // Hapus spasi untuk pencocokan
                let accountNo = bankData[1];
                const accountName = bankData[bankData.length - 1].toUpperCase();

                // Logika Prefix E-Wallet
                const prefixes = {
                    'LINKAJA': '09110',
                    'OVO': '39358',
                    'GOPAY': '70001',
                    'DANA': '3901'
                };

                // Cek apakah bankName ada dalam daftar prefix
                if (prefixes[bankName]) {
                    const prefix = prefixes[bankName];
                    // Tambahkan prefix jika belum ada di depan nomor rekening
                    if (!accountNo.startsWith(prefix)) {
                        accountNo = prefix + accountNo;
                    }
                }

                const row = tbody.insertRow();
                row.innerHTML = `
                    <td style="text-align: left;">${bankData[0].toUpperCase()}</td>
                    <td style="text-align: left;">${accountNo}</td>
                    <td style="text-align: left;">${userId}</td>
                    <td style="text-align: left;">${accountName}</td>
                    <td style="text-align: right;">${nominal}</td>
                `;
            }
        }
    });

    if (tbody.rows.length > 0) {
        showToast(`${tbody.rows.length} data WD berhasil diproses`, 'success');
    }
};

window.clearAdminWD = () => {
    const input = document.getElementById('admin-wd-input');
    const tbody = document.getElementById('admin-wd-body');
    if (input) input.value = '';
    if (tbody) tbody.innerHTML = '';
    showToast('Admin WD cleared', 'info');
};

// --- KlikBCA Deposit Shortcut Logic ---
window.processKlikBCA = () => {
    const input = document.getElementById('klikbca-input');
    const tbody = document.getElementById('klikbca-body');
    if (!input || !tbody) return;

    const rawData = input.value.trim();
    if (!rawData) {
        tbody.innerHTML = '';
        return;
    }

    // Pembersihan: KlikBCA sering kali memiliki data dalam satu baris besar atau baris-baris berantakan
    // Kita cari pola: PEND [TAB] "DESCRIPTION" [TAB] 0 [TAB] NOMINAL
    // Kita split berdasarkan kata "PEND" di awal data atau baris baru
    const entries = rawData.split(/\n?(?=PEND)/);
    tbody.innerHTML = '';

    entries.forEach(entry => {
        if (!entry.trim()) return;

        // Bersihkan tanda kutip ganda dan sinkronkan baris baru
        const cleanEntry = entry.replace(/"/g, '');

        // Split berdasarkan tab
        const columns = cleanEntry.split('\t');

        if (columns.length >= 4) {
            // Kolom 1 (Index 1) adalah deskripsi yang berisi Nama
            // Kadang deskripsi ini bertingkat (berisi \n)
            const descLines = columns[1].split('\n').map(l => l.trim()).filter(l => l !== '');
            // Nama pengirim biasanya ada di baris paling bawah dari deskripsi bertingkat
            // Namun jika ada info sampah di bawah nama, kita butuh logika lebih cerdas
            // Pada contoh user: baris terakhir deskripsi ADALAH namanya.
            const mutationName = descLines[descLines.length - 1];

            // Kolom 3 (Index 3) biasanya nominal (misal 50,000.00)
            let rawNominal = columns[3] || '0';
            const nominal = rawNominal.split('.')[0]; // Buang desimal .00

            if (mutationName && nominal !== '0') {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td style="text-align: left; font-weight: 700; color: #ffcc00; padding: 12px 15px;">${mutationName.toUpperCase()}</td>
                    <td style="text-align: left; font-weight: 800; padding: 12px 15px;">${nominal}</td>
                `;
            }
        }
    });

    if (tbody.rows.length > 0) {
        showToast(`${tbody.rows.length} mutasi KlikBCA berhasil diekstrak`, 'success');
    }
};

window.clearKlikBCA = () => {
    const input = document.getElementById('klikbca-input');
    const tbody = document.getElementById('klikbca-body');
    if (input) input.value = '';
    if (tbody) tbody.innerHTML = '';
    showToast('KlikBCA tool cleared', 'info');
};

// --- MyBCA Deposit Shortcut Logic ---
window.processMyBCA = () => {
    const input = document.getElementById('mybca-input');
    const tbody = document.getElementById('mybca-body');
    if (!input || !tbody) return;

    const rawData = input.value.trim();
    if (!rawData) {
        tbody.innerHTML = '';
        return;
    }

    const lines = rawData.split('\n');
    tbody.innerHTML = '';

    lines.forEach(line => {
        if (!line.trim()) return;

        // Split berdasarkan tab (format copy-paste dari website/tabel)
        const cols = line.split('\t');

        if (cols.length >= 3) {
            const desc = cols[1]; // Deskripsi (tengah)
            const amountCol = cols[2]; // Nominal (IDR 100,000.00)

            // 1. Ekstrak Nominal dari kolom IDR
            let nominal = '0';
            const amountMatch = amountCol.match(/IDR\s*([\d,.]+)/i);
            if (amountMatch) {
                nominal = amountMatch[1].split('.')[0]; // Ambil bagian ribuannya saja (tanpa .00)
            }

            // 2. Ekstrak Nama dari Deskripsi
            let name = '';

            // Pola Umum: [INFO] [NOMINAL_TANPA_KOMA] [NAMA]
            // Contoh: ... WS95271 100000.00 DIMAS ERLANGGA
            // Kita cari angka nominal yang ada di deskripsi untuk memotong bagian depannya
            const nominalInDescMatch = desc.match(/(\d+\.\d{2})\s+(.+)$/);
            if (nominalInDescMatch) {
                name = nominalInDescMatch[2].trim();
            }

            // 3. Penanganan Khusus untuk TRFDN / ESPAY
            // Contoh: ... TRFDN-AHMAD RIFALD ESPAY DEBIT INDONE
            if (name.includes('TRFDN-')) {
                const trfdnMatch = name.match(/TRFDN-([^\s]+(?:\s+[^\s]+)?)/i);
                if (trfdnMatch) {
                    name = trfdnMatch[1];
                }
            }

            // Bersihkan teks sampah tambahan di akhir nama jika ada
            name = name.replace(/ESPAY.*|DEBIT.*|INDONE.*/gi, '').trim();

            if (name && nominal !== '0') {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td style="text-align: left; font-weight: 700; color: #ffcc00; padding: 12px 15px;">${name.toUpperCase()}</td>
                    <td style="text-align: left; font-weight: 800; padding: 12px 15px;">${nominal}</td>
                `;
            }
        }
    });

    if (tbody.rows.length > 0) {
        showToast(`${tbody.rows.length} mutasi MyBCA berhasil diproses`, 'success');
    }
};

window.clearMyBCA = () => {
    const input = document.getElementById('mybca-input');
    const tbody = document.getElementById('mybca-body');
    if (input) input.value = '';
    if (tbody) tbody.innerHTML = '';
    showToast('MyBCA tool cleared', 'info');
};

// --- CEK BTM WD Shortcut Logic ---
window.processBTM = () => {
    const input = document.getElementById('btm-wd-input');
    const tbody = document.getElementById('btm-wd-body');
    const banner = document.getElementById('btm-status-banner');
    const totalDisplay = document.getElementById('btm-total-display');
    if (!input || !tbody) return;

    const rawData = input.value.trim();
    if (!rawData) {
        tbody.innerHTML = '';
        if (banner) banner.style.display = 'none';
        return;
    }

    const lines = rawData.split('\n');
    tbody.innerHTML = '';
    let totalTurnover = 0;

    lines.forEach(line => {
        if (!line.trim()) return;
        if (line.toLowerCase().includes('debet') && line.toLowerCase().includes('kredit')) return;

        const cols = line.split('\t');
        if (cols.length >= 10) {
            const row = tbody.insertRow();

            // Kolom: No, Periode, Date, Keterangan, ID, Status, Debet, Kredit, Balance, Via
            cols.forEach((val, idx) => {
                const td = row.insertCell();
                td.innerText = val.trim();

                // Hitung Total Debet (Turnover) (Index 6)
                if (idx === 6) {
                    const statusVal = cols[5] ? cols[5].trim().toLowerCase() : '';
                    const dVal = parseFloat(val.replace(/,/g, ''));

                    // Hanya hitung jika status BUKAN 'withdraw'
                    if (!isNaN(dVal) && statusVal !== 'withdraw') {
                        totalTurnover += dVal;
                    }

                    td.style.background = '#d00000';
                    td.style.color = '#fff';
                    td.style.fontWeight = '900';
                    td.style.textAlign = 'right';
                }

                if (idx === 7 || idx === 8) td.style.textAlign = 'right';
            });
        }
    });

    if (tbody.rows.length > 0) {
        if (banner) {
            banner.style.display = 'block';
            const bannerTop = banner.querySelector('.btm-banner-top');
            const status = totalTurnover >= 30000 ? 'PROSES' : 'RIJECK';

            if (status === 'PROSES') {
                bannerTop.innerText = "SUDAH CAPAI TURNOVER 'PROSES'";
                banner.style.borderColor = '#00ff00';
                bannerTop.style.background = '#00ff00';
                bannerTop.style.color = '#000';
                if (totalDisplay) totalDisplay.style.color = '#00ff00';
            } else {
                bannerTop.innerText = "BELUM CAPAI TURNOVER 'RIJECK'";
                banner.style.borderColor = '#ff4757';
                bannerTop.style.background = '#ff4757';
                bannerTop.style.color = '#fff';
                if (totalDisplay) totalDisplay.style.color = '#ff4757';
            }
        }
        if (totalDisplay) {
            totalDisplay.innerText = `RP${totalTurnover.toLocaleString('en-US')}`;
        }
        showToast(`BTM Validated: ${tbody.rows.length} rows`, 'success');
    } else {
        if (banner) banner.style.display = 'none';
    }
};

window.clearBTM = () => {
    const input = document.getElementById('btm-wd-input');
    const tbody = document.getElementById('btm-wd-body');
    const banner = document.getElementById('btm-status-banner');
    if (input) input.value = '';
    if (tbody) tbody.innerHTML = '';
    if (banner) banner.style.display = 'none';
    showToast('BTM tool cleared', 'info');
};

processRobotData('bank-input', 'bank-result-body', 'bank');
processRobotData('wallet-input', 'wallet-result-body', 'wallet');

window.copyTable = (tableId) => {
    const table = document.getElementById(tableId);
    if (!table) return;

    // Ambil hanya baris dari tbody (mengabaikan header statis)
    const rows = Array.from(table.querySelectorAll('tbody tr'));

    if (rows.length === 0) {
        showToast('Tidak ada data untuk disalin', 'warning');
        return;
    }

    // Format data menjadi teks dengan pemisah TAB (cocok untuk Excel/Spreadsheet)
    const textToCopy = rows.map(row => {
        return Array.from(row.cells).map(cell => cell.innerText.trim()).join('\t');
    }).join('\n');

    navigator.clipboard.writeText(textToCopy).then(() => {
        showToast('Data berhasil disalin (tanpa header)', 'success');
    }).catch(err => {
        console.error('Gagal menyalin:', err);
        showToast('Gagal menyalin data', 'error');
    });
};

window.clearRobotTool = (type) => {
    const input = document.getElementById(`${type}-input`);
    const tbody = document.getElementById(`${type}-result-body`);
    if (input) input.value = '';
    if (tbody) tbody.innerHTML = '';
    showToast(`${type.toUpperCase()} data cleared`, 'info');
};

// --- BAGI NOMINAL WD BESAR Logic ---

window.formatAndSplitWD = (input) => {
    // Remove non-numeric characters
    let value = input.value.replace(/[^0-9]/g, '');
    if (!value) {
        input.value = '';
        renderSplitRows([]);
        return;
    }

    const total = parseInt(value);
    // Limit to 40,000,000 per chunk
    const limit = 40000000;
    let remaining = total;
    let chunks = [];

    while (remaining > 0) {
        if (remaining > limit) {
            chunks.push(limit);
            remaining -= limit;
        } else {
            chunks.push(remaining);
            remaining = 0;
        }
    }

    // Display formatted total in input
    input.value = total.toLocaleString('en-US');

    renderSplitRows(chunks);
};

function renderSplitRows(chunks) {
    const container = document.getElementById('wd-split-results');
    const footer = document.getElementById('wd-split-footer');

    if (!container || !footer) return;

    if (chunks.length === 0) {
        container.innerHTML = `
            <div class="split-row empty">
                <div class="copy-side left">COPY INI<br> >> </div>
                <div class="split-value">0</div>
                <div class="copy-side right"> << <br>COPY INI</div>
            </div>
        `;
        footer.textContent = '0';
        return;
    }

    container.innerHTML = '';
    let totalSum = 0;
    chunks.forEach(val => {
        totalSum += val;
        const row = document.createElement('div');
        row.className = 'split-row';
        const formatted = val.toLocaleString('en-US');

        row.innerHTML = `
            <div class="copy-side left" onclick="copyValue('${val}')">COPY INI<br> >> </div>
            <div class="split-value" onclick="copyValue('${val}')" style="cursor:pointer;">${formatted}</div>
            <div class="copy-side right" onclick="copyValue('${val}')"> << <br>COPY INI</div>
        `;
        container.appendChild(row);
    });

    // No extra empty rows needed as per user request
    // Just keep the content compact

    // Update footer with formatted total
    footer.textContent = totalSum.toLocaleString('en-US');
}

window.copyValue = (val) => {
    navigator.clipboard.writeText(val).then(() => {
        showToast(`Copied: ${parseInt(val).toLocaleString('en-US')}`, 'success');
    }).catch(err => {
        showToast('Gagal menyalin', 'error');
    });
};

window.copyAllSplitResults = () => {
    const rows = document.querySelectorAll('#wd-split-results .split-row:not(.empty) .split-value');
    if (rows.length === 0) {
        showToast('Tidak ada data untuk disalin', 'warning');
        return;
    }

    const textToCopy = Array.from(rows).map(el => el.textContent.replace(/,/g, '')).join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
        showToast('Semua nominal berhasil disalin!', 'success');
    }).catch(err => {
        showToast('Gagal menyalin semua', 'error');
    });
};

window.clearSplitTool = () => {
    const input = document.getElementById('wd-total-input');
    if (input) input.value = '';
    renderSplitRows([]);
    showToast('Split tool cleared', 'info');
};

function updateClock() { document.getElementById('current-time').textContent = new Date().toLocaleTimeString(); }
setInterval(updateClock, 1000);
updateClock();

// --- MIX PARLAY CALCULATOR LOGIC ---

let parlayMatches = [];

window.initParlay = () => {
    // Add 3 default matches
    if (parlayMatches.length === 0) {
        addParlayMatch();
        addParlayMatch();
        addParlayMatch();
    }
};

window.addParlayMatch = () => {
    const id = Date.now() + Math.random().toString(16).slice(2);
    parlayMatches.push({
        id: id,
        odds: 1.0,
        status: 'win_full'
    });
    renderParlayMatches();
    calculateParlay();
};

window.removeParlayMatch = (id) => {
    parlayMatches = parlayMatches.filter(m => m.id !== id);
    renderParlayMatches();
    calculateParlay();
};

window.updateParlayOdds = (id, val) => {
    const match = parlayMatches.find(m => m.id === id);
    if (match) {
        match.odds = parseFloat(val) || 1.0;
        calculateParlay();
    }
};

window.updateParlayStatus = (id, status) => {
    const match = parlayMatches.find(m => m.id === id);
    if (match) {
        match.status = status;
        calculateParlay();
    }
};

window.renderParlayMatches = () => {
    const container = document.getElementById('parlay-matches-container');
    if (!container) return;

    container.innerHTML = '';

    parlayMatches.forEach((match, index) => {
        const el = document.createElement('div');
        el.className = 'parlay-match-item';
        el.innerHTML = `
            <div class="match-header">
                <h4>Partai ${index + 1}</h4>
                <button class="btn-icon delete" onclick="removeParlayMatch('${match.id}')" title="Hapus Partai">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="match-content">
                <div class="form-group" style="margin:0;">
                    <label style="font-size:0.8rem; margin-bottom:5px;">ODDS</label>
                    <input type="number" class="match-odds-input" 
                        value="${match.odds}" 
                        oninput="updateParlayOdds('${match.id}', this.value)" 
                        step="0.01" min="1.0">
                </div>
                <div class="match-status-options">
                    <label>
                        <input type="radio" name="status-${match.id}" value="win_full" 
                        ${match.status === 'win_full' ? 'checked' : ''}
                        onchange="updateParlayStatus('${match.id}', 'win_full')">
                        Menang Full
                    </label>
                    <label>
                        <input type="radio" name="status-${match.id}" value="win_half" 
                        ${match.status === 'win_half' ? 'checked' : ''}
                        onchange="updateParlayStatus('${match.id}', 'win_half')">
                        Menang 1/2
                    </label>
                    <label>
                        <input type="radio" name="status-${match.id}" value="lose_half" 
                        ${match.status === 'lose_half' ? 'checked' : ''}
                        onchange="updateParlayStatus('${match.id}', 'lose_half')">
                        Kalah 1/2
                    </label>
                    <label>
                        <input type="radio" name="status-${match.id}" value="draw" 
                        ${match.status === 'draw' ? 'checked' : ''}
                        onchange="updateParlayStatus('${match.id}', 'draw')">
                        Seri
                    </label>
                </div>
            </div>
        `;
        container.appendChild(el);
    });
};

window.calculateParlay = () => {
    const betInput = document.getElementById('parlay-bet-input');
    const totalOddsDisplay = document.getElementById('parlay-total-odds');
    const netWinDisplay = document.getElementById('parlay-net-win');
    const payoutDisplay = document.getElementById('parlay-payout');

    if (!betInput || parlayMatches.length === 0) return;

    let betAmount = parseFloat(betInput.value.replace(/,/g, '')) || 0;

    let totalOdds = 1.0;

    parlayMatches.forEach(m => {
        let effectiveOdds = 1.0;

        // Rumus Mix Parlay
        switch (m.status) {
            case 'win_full':
                effectiveOdds = m.odds;
                break;
            case 'win_half':
                // ((Odds - 1) / 2) + 1
                effectiveOdds = ((m.odds - 1) / 2) + 1;
                break;
            case 'lose_half':
                // Odds konstan 0.5
                effectiveOdds = 0.5;
                break;
            case 'draw':
                effectiveOdds = 1.0;
                break;
            default:
                effectiveOdds = 1.0;
        }

        totalOdds *= effectiveOdds;
    });

    // Rounding total odds to 3 decimals usually
    const roundedOdds = Math.round(totalOdds * 1000) / 1000;

    const payout = Math.floor(betAmount * totalOdds);
    const netWin = Math.max(0, payout - betAmount);

    totalOddsDisplay.textContent = roundedOdds.toFixed(3);
    netWinDisplay.innerText = `IDR ${netWin.toLocaleString('en-US')}`;
    payoutDisplay.innerText = `IDR ${payout.toLocaleString('en-US')}`;
};





// Initialize components
initParlay();


// --- LIVE TOGEL SYSTEM ---
const pasaranData = [
    {
        nama: "HOKIDRAW",
        betClose: "00:00:00",
        result: "00:00:00",
        linkResmi: "https://dlive.tv/u/HOKIDRAW",
        linkAcuan: "https://hokidraw.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "TOTO MACAU PAGI",
        betClose: "00:00:01",
        result: "00:15:00",
        linkResmi: "https://kick.com/live-ttm4d",
        linkAcuan: "-",
        logo: "https://cdn.areabermain.club/assets/cdn/az2/2024/12/01/20241201/f70c3022131972b7a83d6a690e54284d/toto-macau-logo.png"
    },
    {
        nama: "HOKIDRAW",
        betClose: "01:00:00",
        result: "01:00:00",
        linkResmi: "https://dlive.tv/u/HOKIDRAW",
        linkAcuan: "https://hokidraw.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "KENTUCKY MIDDAY",
        betClose: "01:05:00",
        result: "01:20:00",
        linkResmi: "https://www.kylottery.com/apps/draw_gamess",
        linkAcuan: "https://play.kylottery.com/en-us/playnow/pick4.html",
        logo: "https://cdn.areabermain.club/assets/cdn/az4/2024/08/11/20240811/a5fafa0102d98ab3959ceb9bb1045729/kl-logo.png"
    },
    {
        nama: "FLORIDA MIDDAY",
        betClose: "01:20:00",
        result: "01:30:00",
        linkResmi: "https://www.youtube.com/@floridalottery/videos",
        linkAcuan: "-",
        logo: "https://cdn.areabermain.club/assets/cdn/az4/2024/08/11/20240811/a3e564ccb04c2b751ad4fa88c06e39c1/1-removebg-preview.png"
    },
    {
        nama: "HUAHIN0100",
        betClose: "00:30:00",
        result: "01:00:00",
        linkResmi: "https://huahinlottery.com/livedraw",
        linkAcuan: "https://www.youtube.com/channel/UCRuZp9SemX0egu2LFGrkEjg",
        logo: "https://huahinlottery.com/assets/img/logo.png"
    },
    {
        nama: "BANGKOK 0130",
        betClose: "01:00:00",
        result: "01:30:00",
        linkResmi: "https://bangkokpoolstoday.com/liveDraw.html",
        linkAcuan: "-",
        logo: "https://bangkokpoolstoday.com/assets/img/bangkokpools_logo.png"
    },
    {
        nama: "HOKIDRAW",
        betClose: "02:00:00",
        result: "02:00:00",
        linkResmi: "https://dlive.tv/u/HOKIDRAW",
        linkAcuan: "https://hokidraw.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "NEW YORK MIDDAY",
        betClose: "02:15:00",
        result: "02:25:00",
        linkResmi: "https://nylottery.ny.gov/draw-game?game=win4",
        linkAcuan: "-",
        logo: "https://edit.nylottery.ny.gov/sites/default/files/logo-2179655b4229a219a9305b3f0e734bd0.png"
    },
    {
        nama: "NORTH CAROLINA DAY",
        betClose: "02:45:00",
        result: "03:00:00",
        linkResmi: "https://www.wral.com/entertainment/lottery/",
        linkAcuan: "https://www.wral.com/news/video/1075494/",
        logo: "https://nclottery.com/Site/GFX/NCEL_Alt.svg"
    },
    {
        nama: "BRUNEI02",
        betClose: "02:30:00",
        result: "02:45:00",
        linkResmi: "https://bruneipools.com/live-draw.html",
        linkAcuan: "-",
        logo: "https://bruneipools.com/assets/img/brunei-logo.png"
    },
    {
        nama: "HOKIDRAW",
        betClose: "03:00:00",
        result: "03:00:00",
        linkResmi: "https://dlive.tv/u/HOKIDRAW",
        linkAcuan: "https://hokidraw.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "OREGON 03",
        betClose: "03:50:00",
        result: "04:00:00",
        linkResmi: "https://www.oregonlottery.org/pick-4/winning-numbers/",
        linkAcuan: "-",
        logo: "https://cdn.areabermain.club/assets/cdn/az9/2024/11/26/20241126/0a72e6fa9a2d4ee4106678a8aeeab33624/favpng-oregon-lottery-video-lottery-terminal-game.png"
    },
    {
        nama: "HOKIDRAW",
        betClose: "04:00:00",
        result: "04:00:00",
        linkResmi: "https://dlive.tv/u/HOKIDRAW",
        linkAcuan: "https://hokidraw.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "HOKIDRAW",
        betClose: "05:00:00",
        result: "05:00:00",
        linkResmi: "https://dlive.tv/u/HOKIDRAW",
        linkAcuan: "https://hokidraw.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "HOKIDRAW",
        betClose: "06:00:00",
        result: "06:00:00",
        linkResmi: "https://dlive.tv/u/HOKIDRAW",
        linkAcuan: "https://hokidraw.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "OREGON 06",
        betClose: "06:50:00",
        result: "07:00:00",
        linkResmi: "https://www.oregonlottery.org/pick-4/winning-numbers/",
        linkAcuan: "-",
        logo: "https://cdn.areabermain.club/assets/cdn/az9/2024/11/26/20241126/0a72e6fa9a2d4ee4106678a8aeeab33624/favpng-oregon-lottery-video-lottery-terminal-game.png"
    },
    {
        nama: "HOKIDRAW",
        betClose: "07:00:00",
        result: "07:00:00",
        linkResmi: "https://dlive.tv/u/HOKIDRAW",
        linkAcuan: "https://hokidraw.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "HOKIDRAW",
        betClose: "08:00:00",
        result: "08:00:00",
        linkResmi: "https://dlive.tv/u/HOKIDRAW",
        linkAcuan: "https://hokidraw.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "HOKIDRAW",
        betClose: "09:00:00",
        result: "09:00:00",
        linkResmi: "https://dlive.tv/u/HOKIDRAW",
        linkAcuan: "https://hokidraw.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "CALIFORNIA",
        betClose: "09:25:00",
        result: "09:30:00",
        linkResmi: "http://www.calottery.com/play/draw-games/daily-4",
        linkAcuan: "-",
        logo: "https://cdn.areabermain.club/assets/cdn/az4/2024/08/11/20240811/7c3b7b0affd7880d2dddf918ba2ac258/calottlogo.png"
    },
    {
        nama: "FLORIDA EVENING",
        betClose: "09:35:00",
        result: "09:45:00",
        linkResmi: "https://www.youtube.com/@floridalottery/videos",
        linkAcuan: "https://floridalottery.com/where-to-play",
        logo: "https://cdn.areabermain.club/assets/cdn/az4/2024/08/11/20240811/a3e564ccb04c2b751ad4fa88c06e39c1/1-removebg-preview.png"
    },
    {
        nama: "OREGON 09",
        betClose: "09:50:00",
        result: "10:00:00",
        linkResmi: "https://www.oregonlottery.org/pick-4/winning-numbers/",
        linkAcuan: "-",
        logo: "https://cdn.areabermain.club/assets/cdn/az9/2024/11/26/20241126/0a72e6fa9a2d4ee4106678a8aeeab33624/favpng-oregon-lottery-video-lottery-terminal-game.png"
    },
    {
        nama: "HOKIDRAW",
        betClose: "10:00:00",
        result: "10:00:00",
        linkResmi: "https://dlive.tv/u/HOKIDRAW",
        linkAcuan: "https://hokidraw.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "BANGKOK 0930",
        betClose: "09:00:00",
        result: "09:30:00",
        linkResmi: "https://bangkokpoolstoday.com/liveDraw.html",
        linkAcuan: "-",
        logo: "https://bangkokpoolstoday.com/assets/img/bangkokpools_logo.png"
    },
    {
        nama: "NEW YORK EVENING",
        betClose: "10:25:00",
        result: "10:35:00",
        linkResmi: "https://nylottery.ny.gov/draw-game?game=win4",
        linkAcuan: "-",
        logo: "https://edit.nylottery.ny.gov/sites/default/files/logo-2179655b4229a219a9305b3f0e734bd0.png"
    },
    {
        nama: "KENTUCKY EVENING",
        betClose: "10:45:00",
        result: "11:00:00",
        linkResmi: "https://www.kylottery.com/apps/draw_games/pick4/index.html",
        linkAcuan: "https://play.kylottery.com/en-us/playnow/pick4.html",
        logo: "https://cdn.areabermain.club/assets/cdn/az4/2024/08/11/20240811/a5fafa0102d98ab3959ceb9bb1045729/kl-logo.png"
    },
    {
        nama: "TOTO CAMBODIA LIVE",
        betClose: "10:45:00",
        result: "11:00:00",
        linkResmi: "https://www.youtube.com/@TotoCambodiaOfficial",
        linkAcuan: "https://totocambodialive.com/live-draw.html",
        logo: "https://cdn.areabermain.club/assets/cdn/az4/2024/08/11/20240811/f07d4e2a6517ef1cea9e2a897e4abb98/cambodia-draw.png"
    },
    {
        nama: "HOKIDRAW",
        betClose: "11:00:00",
        result: "11:00:00",
        linkResmi: "https://dlive.tv/u/HOKIDRAW",
        linkAcuan: "https://hokidraw.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "CAROLINA EVENING",
        betClose: "11:17:00",
        result: "11:22:00",
        linkResmi: "https://www.wral.com/entertainment/lottery/",
        linkAcuan: "https://www.wral.com/news/video/1075494/",
        logo: "https://nclottery.com/Site/GFX/NCEL_Alt.svg"
    },
    {
        nama: "CHELSEA11",
        betClose: "11:00:00",
        result: "11:15:00",
        linkResmi: "https://chelseapools.co.uk/",
        linkAcuan: "-",
        logo: "https://chelseapools.co.uk/assets/img/chelseaPools_logo.png"
    },
    {
        nama: "HOKIDRAW",
        betClose: "12:00:00",
        result: "12:00:00",
        linkResmi: "https://dlive.tv/u/HOKIDRAW",
        linkAcuan: "https://hokidraw.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "BULLSEYE",
        betClose: "12:00:00",
        result: "12:15:00",
        linkResmi: "https://mylotto.co.nz/results/bullseye",
        linkAcuan: "-",
        logo: "https://cdn.areabermain.club/assets/cdn/az4/2024/08/11/20240811/f07d4e2a6517ef1cea9e2a897e4abb98/nz-bullseye.png"
    },
    {
        nama: "POIPET12",
        betClose: "12:15:00",
        result: "12:30:00",
        linkResmi: "https://www.youtube.com/channel/UCASg7YGGNAJ9saOZVeqVVuw",
        linkAcuan: "https://poipetlottery.com/liveresult",
        logo: "https://poipetpools.com/assets/img/poipet_logo.png"
    },
    {
        nama: "HOKIDRAW",
        betClose: "13:00:00",
        result: "13:00:00",
        linkResmi: "https://dlive.tv/u/HOKIDRAW",
        linkAcuan: "https://hokidraw.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "OREGON 12",
        betClose: "12:50:00",
        result: "13:00:00",
        linkResmi: "https://www.oregonlottery.org/pick-4/winning-numbers/",
        linkAcuan: "-",
        logo: "https://cdn.areabermain.club/assets/cdn/az9/2024/11/26/20241126/0a72e6fa9a2d4ee4106678a8aeeab33624/favpng-oregon-lottery-video-lottery-terminal-game.png"
    },
    {
        nama: "TOTO MACAU SIANG",
        betClose: "13:00:00",
        result: "13:15:00",
        linkResmi: "https://kick.com/live-ttm4d",
        linkAcuan: "-",
        logo: "https://cdn.areabermain.club/assets/cdn/az2/2024/12/01/20241201/f70c3022131972b7a83d6a690e54284d/toto-macau-logo.png"
    },
    {
        nama: "SYDNEY LOTTO",
        betClose: "13:25:00",
        result: "13:50:00",
        linkResmi: "https://www.youtube.com/@SYDNEYLOTTOOFFICIAL1",
        linkAcuan: "https://lottosydney.fun/",
        logo: "https://sydneypoolstoday.com/assets/img/sydneypoolstoday.png"
    },
    {
        nama: "HOKIDRAW",
        betClose: "14:00:00",
        result: "14:00:00",
        linkResmi: "https://dlive.tv/u/HOKIDRAW",
        linkAcuan: "https://hokidraw.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "BRUNEI14",
        betClose: "14:30:00",
        result: "14:45:00",
        linkResmi: "https://bruneipools.com/live-draw.html",
        linkAcuan: "-",
        logo: "https://bruneipools.com/assets/img/brunei-logo.png"
    },
    {
        nama: "HOKIDRAW",
        betClose: "15:00:00",
        result: "15:00:00",
        linkResmi: "https://dlive.tv/u/HOKIDRAW",
        linkAcuan: "https://hokidraw.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "CHELSEA15",
        betClose: "15:00:00",
        result: "15:15:00",
        linkResmi: "https://chelseapools.co.uk/",
        linkAcuan: "-",
        logo: "https://chelseapools.co.uk/assets/img/chelseaPools_logo.png"
    },
    {
        nama: "POIPET15",
        betClose: "15:15:00",
        result: "15:30:00",
        linkResmi: "https://www.youtube.com/channel/UCASg7YGGNAJ9saOZVeqVVuw",
        linkAcuan: "https://poipetlottery.com/liveresult",
        logo: "https://poipetpools.com/assets/img/poipet_logo.png"
    },
    {
        nama: "TOTOMALI1530",
        betClose: "15:15:00",
        result: "15:30:00",
        linkResmi: "https://www.youtube.com/@TotoMaliLive",
        linkAcuan: "https://totomali.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "HOKIDRAW",
        betClose: "16:00:00",
        result: "16:00:00",
        linkResmi: "https://dlive.tv/u/HOKIDRAW",
        linkAcuan: "https://hokidraw.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "TOTO MACAU SORE",
        betClose: "16:00:00",
        result: "16:15:00",
        linkResmi: "https://kick.com/live-ttm4d",
        linkAcuan: "-",
        logo: "https://cdn.areabermain.club/assets/cdn/az2/2024/12/01/20241201/f70c3022131972b7a83d6a690e54284d/toto-macau-logo.png"
    },
    {
        nama: "HUAHIN1630",
        betClose: "16:00:00",
        result: "16:30:00",
        linkResmi: "https://huahinlottery.com/",
        linkAcuan: "https://www.youtube.com/channel/UCRuZp9SemX0egu2LFGrkEjg",
        logo: "https://huahinlottery.com/assets/img/logo.png"
    },
    {
        nama: "HOKIDRAW",
        betClose: "17:00:00",
        result: "17:00:00",
        linkResmi: "https://dlive.tv/u/HOKIDRAW",
        linkAcuan: "https://hokidraw.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "KING KONG4D SORE",
        betClose: "17:00:00",
        result: "17:15:00",
        linkResmi: "https://kingkongpools.com/",
        linkAcuan: "-",
        logo: "https://cdn.areabermain.club/assets/cdn/az9/2024/11/26/20241126/d1f18e378e4a422b41ffe8d03065ce7d/logo-7.png"
    },
    {
        nama: "SINGAPORE",
        betClose: "17:30:00",
        result: "17:45:00",
        linkResmi: "http://www.singaporepools.com.sg",
        linkAcuan: "-",
        logo: "https://cdn.areabermain.club/assets/cdn/az9/2024/11/26/20241126/651f502072e9d29074094a4066928e35/sgpools.png"
    },
    {
        nama: "HOKIDRAW",
        betClose: "18:00:00",
        result: "18:00:00",
        linkResmi: "https://dlive.tv/u/HOKIDRAW",
        linkAcuan: "https://hokidraw.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "MAGNUM4D",
        betClose: "18:10:00",
        result: "18:40:00",
        linkResmi: "https://www.magnum4d.my/en/",
        linkAcuan: "-",
        logo: "https://cdn.areabermain.club/assets/cdn/az4/2024/08/11/20240811/8889f1c5fc738b5148145100c08a0ebc/439-4390693-magnum-pengeluaran-magnum-4d-hari-clipart-removebg-preview.png"
    },
    {
        nama: "HOKIDRAW",
        betClose: "19:00:00",
        result: "19:00:00",
        linkResmi: "https://dlive.tv/u/HOKIDRAW",
        linkAcuan: "https://hokidraw.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "TOTO MACAU MALAM 1",
        betClose: "19:00:00",
        result: "19:15:00",
        linkResmi: "https://kick.com/live-ttm4d",
        linkAcuan: "-",
        logo: "https://cdn.areabermain.club/assets/cdn/az2/2024/12/01/20241201/f70c3022131972b7a83d6a690e54284d/toto-macau-logo.png"
    },
    {
        nama: "CHELSEA19",
        betClose: "19:00:00",
        result: "19:15:00",
        linkResmi: "https://chelseapools.co.uk/",
        linkAcuan: "-",
        logo: "https://chelseapools.co.uk/assets/img/chelseaPools_logo.png"
    },
    {
        nama: "POIPET19",
        betClose: "19:30:00",
        result: "19:45:00",
        linkResmi: "https://www.youtube.com/channel/UCASg7YGGNAJ9saOZVeqVVuw",
        linkAcuan: "https://poipetlottery.com/liveresult",
        logo: "https://poipetpools.com/assets/img/poipet_logo.png"
    },
    {
        nama: "HOKIDRAW",
        betClose: "20:00:00",
        result: "20:00:00",
        linkResmi: "https://dlive.tv/u/HOKIDRAW",
        linkAcuan: "https://hokidraw.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "PCSO",
        betClose: "19:50:00",
        result: "20:10:00",
        linkResmi: "https://www.pcso.gov.ph/LiveStreaming.aspx",
        linkAcuan: "https://www.youtube.com/watch?v=POvsGpYUeHg",
        logo: "https://pcso.gov.ph/Images/Logos/PCSO_Logo.png"
    },
    {
        nama: "TOTOMALI2030",
        betClose: "20:15:00",
        result: "20:30:00",
        linkResmi: "https://www.youtube.com/@TotoMaliLive",
        linkAcuan: "https://totomali.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "HOKIDRAW",
        betClose: "21:00:00",
        result: "21:00:00",
        linkResmi: "https://dlive.tv/u/HOKIDRAW",
        linkAcuan: "https://hokidraw.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "HUAHIN2100",
        betClose: "20:30:00",
        result: "21:00:00",
        linkResmi: "https://huahinlottery.com/",
        linkAcuan: "https://www.youtube.com/channel/UCRuZp9SemX0egu2LFGrkEjg",
        logo: "https://huahinlottery.com/assets/img/logo.png"
    },
    {
        nama: "CHELSEA21",
        betClose: "21:00:00",
        result: "21:15:00",
        linkResmi: "https://chelseapools.co.uk/",
        linkAcuan: "-",
        logo: "https://chelseapools.co.uk/assets/img/chelseaPools_logo.png"
    },
    {
        nama: "NEVADA",
        betClose: "21:15:00",
        result: "21:30:00",
        linkResmi: "https://www.nevadalottery.us",
        linkAcuan: "-",
        logo: "https://www.nevadalottery.us/images/logo.gif"
    },
    {
        nama: "BRUNEI21",
        betClose: "21:30:00",
        result: "21:45:00",
        linkResmi: "https://bruneipools.com/live-draw.html",
        linkAcuan: "-",
        logo: "https://bruneipools.com/assets/img/brunei-logo.png"
    },
    {
        nama: "HOKIDRAW",
        betClose: "22:00:00",
        result: "22:00:00",
        linkResmi: "https://dlive.tv/u/HOKIDRAW",
        linkAcuan: "https://hokidraw.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "TOTO MACAU MALAM 2",
        betClose: "22:00:00",
        result: "22:15:00",
        linkResmi: "https://kick.com/live-ttm4d",
        linkAcuan: "-",
        logo: "https://cdn.areabermain.club/assets/cdn/az2/2024/12/01/20241201/f70c3022131972b7a83d6a690e54284d/toto-macau-logo.png"
    },
    {
        nama: "POIPET22",
        betClose: "22:30:00",
        result: "22:45:00",
        linkResmi: "https://www.youtube.com/channel/UCASg7YGGNAJ9saOZVeqVVuw",
        linkAcuan: "https://poipetlottery.com/liveresult",
        logo: "https://poipetpools.com/assets/img/poipet_logo.png"
    },
    {
        nama: "HONGKONG LOTTO",
        betClose: "22:35:00",
        result: "23:00:00",
        linkResmi: "https://kick.com/hongkong-lotto-official",
        linkAcuan: "-",
        logo: "https://cdn.areabermain.club/assets/cdn/az2/2024/12/01/20241201/a95376101165db91cfcd742f66dd8564/hklott.png"
    },
    {
        nama: "TOTO MACAU MALAM 3",
        betClose: "22:00:00",
        result: "22:15:00",
        linkResmi: "https://kick.com/live-ttm4d",
        linkAcuan: "-",
        logo: "https://cdn.areabermain.club/assets/cdn/az2/2024/12/01/20241201/f70c3022131972b7a83d6a690e54284d/toto-macau-logo.png"
    },
    {
        nama: "KING KONG4D MALAM",
        betClose: "23:30:00",
        result: "23:45:00",
        linkResmi: "https://kick.com/king-kong-pools",
        linkAcuan: "-",
        logo: "https://cdn.areabermain.club/assets/cdn/az9/2024/11/26/20241126/d1f18e378e4a422b41ffe8d03065ce7d/logo-7.png"
    },
    {
        nama: "TOTOMALI2330",
        betClose: "23:15:00",
        result: "23:30:00",
        linkResmi: "https://www.youtube.com/@TotoMaliLive",
        linkAcuan: "https://totomali.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    },
    {
        nama: "HOKIDRAW",
        betClose: "23:15:00",
        result: "23:30:00",
        linkResmi: "https://dlive.tv/u/HOKIDRAW",
        linkAcuan: "https://hokidraw.com/live-draw.html",
        logo: "https://cdn-icons-png.flaticon.com/512/3069/3069188.png"
    }
];

let currentPreviewUrl = '';
let currentPreviewTitle = '';
let countdownIntervals = {};
let liveDrawInitialized = false;

function timeToSeconds(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    const s = parseInt(parts[2]) || 0;
    return h * 3600 + m * 60 + s;
}

function getFrameStatus(betTimeStr, resultTimeStr) {
    const now = new Date();
    const nowTime = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const betTimeSec = timeToSeconds(betTimeStr);
    const resultTimeSec = timeToSeconds(resultTimeStr);

    if (nowTime > resultTimeSec) return { status: 'closed', color: 'closed', text: 'CLOSED' };
    if (nowTime > betTimeSec) return { status: 'result', color: 'result', text: 'RESULT' };
    if (betTimeSec - nowTime <= 900) return { status: 'bet-close', color: 'bet-close', text: 'BET CLOSE' };
    return { status: 'open', color: 'open', text: 'OPEN' };
}

function getTimeRemaining(betTimeStr) {
    const now = new Date();
    const nowTime = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const betTimeSec = timeToSeconds(betTimeStr);
    const rem = betTimeSec - nowTime;
    if (rem <= 0) return null;
    return {
        hours: Math.floor(rem / 3600),
        minutes: Math.floor((rem % 3600) / 60),
        seconds: rem % 60,
        total: rem
    };
}

function formatTime(timeStr) {
    if (!timeStr) return "--:--";
    const parts = timeStr.split(':');
    return parts[0] + ':' + parts[1];
}

function createMarketFrame(pasaran, index) {
    const statusInfo = getFrameStatus(pasaran.betClose, pasaran.result);
    const timeRemaining = getTimeRemaining(pasaran.betClose);
    const isPast = pasaran.nama.includes("HOKIDRAW") ? (timeToSeconds(pasaran.result) < (new Date().getHours() * 3600 + new Date().getMinutes() * 60 + new Date().getSeconds())) : statusInfo.status === 'closed';

    const frame = document.createElement('div');
    frame.className = `market-frame ${statusInfo.color} ${isPast ? 'result-past' : ''}`;
    frame.id = `market-frame-${index}`;
    frame.setAttribute('data-bet-close', pasaran.betClose);
    frame.setAttribute('data-result', pasaran.result);

    let countdownHTML = '';
    if (timeRemaining) {
        countdownHTML = `
            <div class="countdown-container">
                <div class="countdown-label">Menuju BET CLOSE:</div>
                <div class="countdown-timer" id="countdown-${index}">
                    ${timeRemaining.hours.toString().padStart(2, '0')}:${timeRemaining.minutes.toString().padStart(2, '0')}:${timeRemaining.seconds.toString().padStart(2, '0')}
                </div>
            </div>
            <div class="progress-container"><div class="progress-bar"></div></div>
        `;
    }

    frame.innerHTML = `
        ${isPast ? '<div class="closed-badge">PASARAN TUTUP</div>' : ''}
        <div class="market-logo-container"><img src="${pasaran.logo}" class="market-logo" onerror="this.src='https://cdn-icons-png.flaticon.com/512/3069/3069188.png'"></div>
        <div class="market-header"><h3 class="market-name">${pasaran.nama}</h3><span class="market-status">${statusInfo.text}</span></div>
        <div class="market-times">
            <div class="time-group"><div class="time-label">BET CLOSE</div><div class="time-value">${formatTime(pasaran.betClose)}</div></div>
            <div class="time-group"><div class="time-label">RESULT</div><div class="time-value">${formatTime(pasaran.result)}</div></div>
        </div>
        ${countdownHTML}
        <div class="market-links">
            <button class="link-btn preview-link-btn" data-url="${pasaran.linkResmi}" data-title="${pasaran.nama}">Preview</button>
            <button class="link-btn preview-link-btn" data-url="${pasaran.linkAcuan}" ${pasaran.linkAcuan === '-' ? 'disabled' : ''}>Acuan</button>
        </div>
    `;
    return frame;
}

function updateCountdown(pasaran, index) {
    const el = document.getElementById(`countdown-${index}`);
    if (!el) return;
    const rem = getTimeRemaining(pasaran.betClose);
    if (!rem) { el.textContent = "00:00:00"; refreshFrameStatus(index, pasaran); return false; }
    el.textContent = `${rem.hours.toString().padStart(2, '0')}:${rem.minutes.toString().padStart(2, '0')}:${rem.seconds.toString().padStart(2, '0')}`;
    return true;
}

function refreshFrameStatus(index, pasaran) {
    const frame = document.getElementById(`market-frame-${index}`);
    if (!frame) return;
    const status = getFrameStatus(pasaran.betClose, pasaran.result);
    frame.className = `market-frame ${status.color}`;
    frame.querySelector('.market-status').textContent = status.text;
}



// =======================================================
// --- LIVE RESULT INTEGRATION (CLIENT-SIDE) ---
// =======================================================
// [USER-ACTION-REQUIRED] REPLACE THIS URL WITH YOUR REAL API URL
const LIVE_RESULT_API_URL = 'https://game-cfg-2.24dgame.com/lottery/correction/CorrectionResultList'; // Placeholder

async function syncLiveResults() {
    try {
        console.log('Fetching live results from:', LIVE_RESULT_API_URL);
        const response = await fetch(LIVE_RESULT_API_URL, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                // Add other headers if needed (e.g., Authorization)
            }
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        // Try parsing as JSON first
        const data = await response.json().catch(() => null);

        if (data && Array.isArray(data)) {
            updateLiveDrawUI(data);
            showToast('Live Results Updated!', 'success');
        } else {
            console.warn('API returned non-JSON or invalid format. Please check API URL.');
            // Fallback: If it returns HTML, you might need a parser here
        }

    } catch (error) {
        console.error('Failed to sync live results:', error);
        // showToast('Failed to sync live results. Check Console.', 'error'); // Optional: Don't spam user
    }
}

function updateLiveDrawUI(data) {
    // Map external names to internal IDs
    // Example Data: { Product: "HONGKONG", WinResult: "4900,0744,9705" }
    const marketMap = {
        "HONGKONG": "hk",
        "SYDNEY": "sdy",
        "SINGAPORE": "sgp",
        // Add more mappings as needed
    };

    data.forEach(item => {
        const internalId = marketMap[item.Product?.toUpperCase()];
        if (internalId) {
            // Find the market frame
            // This assumes your market frames have some ID or data-attribute to identify them
            // Since we generate them dynamically in renderMarketFrames, we might need to adjust logic there
            // For now, let's try to find by market name in the DOM

            const frames = document.querySelectorAll('.market-frame');
            frames.forEach(frame => {
                const title = frame.querySelector('.market-name')?.textContent?.trim()?.toUpperCase(); // Changed from .market-title to .market-name
                if (title === item.Product?.toUpperCase()) {
                    const numEl = frame.querySelector('.market-numbers');
                    if (numEl && item.WinResult) {
                        // WinResult might be '4900,0744...'. We usually take the first one or split
                        const mainResult = item.WinResult.split(',')[0];

                        // Animation effect
                        if (numEl.textContent !== mainResult) {
                            numEl.style.transform = 'scale(1.2)';
                            numEl.style.color = '#fff';
                            setTimeout(() => {
                                numEl.textContent = mainResult;
                                numEl.style.transform = 'scale(1)';
                                numEl.style.color = 'var(--primary)';
                            }, 300);
                        }
                    }
                }
            });
        }
    });
}

// Auto-sync every 60 seconds
setInterval(syncLiveResults, 60000);

// Initial sync
setTimeout(syncLiveResults, 5000); // Delay slightly to ensure load

function renderMarketFrames(data) {
    const container = document.getElementById('marketFramesContainer');
    if (!container) return;
    container.innerHTML = '';
    Object.values(countdownIntervals).forEach(clearInterval);
    data.forEach((p, i) => {
        container.appendChild(createMarketFrame(p, i));
        if (getTimeRemaining(p.betClose)) {
            countdownIntervals[i] = setInterval(() => { if (!updateCountdown(p, i)) clearInterval(countdownIntervals[i]); }, 1000);
        }
    });
    document.querySelectorAll('.preview-link-btn').forEach(btn => {
        btn.onclick = () => showLinkPreview(btn.getAttribute('data-url'), btn.getAttribute('data-title'));
    });
}

function filterData() {
    const s = document.getElementById('searchInput').value.toLowerCase();
    const f = document.getElementById('statusFilter').value;
    const filtered = pasaranData.filter(p => p.nama.toLowerCase().includes(s) && (f === 'all' || getFrameStatus(p.betClose, p.result).status === f));
    renderMarketFrames(filtered);
}

function showLinkPreview(url, title) {
    currentPreviewUrl = url;
    const modal = document.getElementById('linkPreviewModal');
    const iframe = document.getElementById('previewFrame');
    const loading = document.getElementById('loadingFrame');
    document.getElementById('previewTitle').textContent = title;
    iframe.src = '';
    loading.style.display = 'flex';
    modal.classList.add('active');
    setTimeout(() => {
        iframe.src = url;
        iframe.onload = () => loading.style.display = 'none';
    }, 500);
}

function closeLinkPreview() {
    document.getElementById('linkPreviewModal').classList.remove('active');
    document.getElementById('previewFrame').src = '';
}

// --- TOGEL SUB-TAB SYSTEM ---
function switchTogelTab(tabId) {
    // Update active pill
    document.querySelectorAll('.tab-pill').forEach(pill => {
        const attr = pill.getAttribute('onclick');
        if (attr && attr.includes(`'${tabId}'`)) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });

    // Update active content
    document.querySelectorAll('.togel-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    const targetContent = document.getElementById(tabId + '-tab');
    if (targetContent) targetContent.classList.add('active');

    // Special handling for tab initialization
    if (tabId === 'live-togel') {
        initLiveDraw();
    } else if (tabId === 'prediksi-togel') {
        if (typeof initPrediction === 'function') initPrediction();
        if (typeof initGuide === 'function') initGuide();
    } else if (tabId === 'buku-mimpi-togel') {
        if (typeof initDreamBook === 'function') initDreamBook();
    }
}



function initLiveDraw() {
    if (liveDrawInitialized) return;
    renderMarketFrames(pasaranData);
    setInterval(() => {
        const el = document.getElementById('live-time');
        if (el) el.textContent = new Date().toLocaleTimeString('id-ID');
    }, 1000);

    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const timeSort = document.getElementById('timeSort');

    if (searchInput) searchInput.oninput = filterData;
    if (statusFilter) statusFilter.onchange = filterData;
    if (timeSort) timeSort.onchange = filterData;

    document.getElementById('closePreviewBtn').onclick = closeLinkPreview;
    document.getElementById('openInNewTabBtn').onclick = () => window.open(currentPreviewUrl, '_blank');
    liveDrawInitialized = true;
}

// =======================================================
// --- SISTEM PREDIKSI TOGEL ---
// =======================================================
let predictionInitialized = false;
(function () {
    'use strict';

    const pasarans = [
        "TOTOMACAU PAGI", "KENTUCKY MIDDAY", "FLORIDA MIDDAY", "HUAHIN 0100",
        "NEWYORK MIDDAY", "BANGKOK 0130", "CAROLINA DAY", "BRUNEI 02",
        "OREGON03", "OREGON06", "CALIFORNIA", "FLORIDA EVENING",
        "OREGON09", "NEWYORK EVENING", "BANGKOK 0930", "KENTUCKY EVENING",
        "CAROLINA EVENING", "TOTO CAMBODIA", "CHELSEA 11",
        "OREGON12", "POIPET 12", "BULLSEYE", "TOTOMACAU SIANG",
        "SYDNEY", "BRUNEI 14", "CHELSEA 15", "HOKI DRAW",
        "POIPET 15", "TOTOMACAU SORE", "HUAHIN 1630", "KING KONG POOLS SORE",
        "SINGAPORE", "MAGNUM4D", "CHELSEA 19", "TOTOMACAU MALAM I",
        "POIPET 19", "PCSO", "HUAHIN 2100", "CHELSEA 21",
        "NEVADA", "BRUNEI 21", "TOTOMACAU MALAM II", "POIPET 22",
        "HONGKONG", "TOTOMACAU MALAM III", "KING KONG POOLS MALAM"
    ];

    const marketLogos = {
        "BANGKOK 0130": "https://bangkokpoolstoday.com/assets/img/bangkokpools_logo.png",
        "BANGKOK 0930": "https://bangkokpoolstoday.com/assets/img/bangkokpools_logo.png",
        "KING KONG POOLS SORE": "https://cdn.areabermain.club/assets/cdn/az9/2024/11/26/20241126/d1f18e378e4a422b41ffe8d03065ce7d/logo-7.png",
        "KING KONG POOLS MALAM": "https://cdn.areabermain.club/assets/cdn/az9/2024/11/26/20241126/d1f18e378e4a422b41ffe8d03065ce7d/logo-7.png",
        "BRUNEI 02": "https://bruneipools.com/assets/img/brunei-logo.png",
        "BRUNEI 14": "https://bruneipools.com/assets/img/brunei-logo.png",
        "BRUNEI 21": "https://bruneipools.com/assets/img/brunei-logo.png",
        "BULLSEYE": "https://cdn.areabermain.club/assets/cdn/az4/2024/08/11/20240811/f07d4e2a6517ef1cea9e2a897e4abb98/nz-bullseye.png",
        "CALIFORNIA": "https://cdn.areabermain.club/assets/cdn/az4/2024/08/11/20240811/7c3b7b0affd7880d2dddf918ba2ac258/calottlogo.png",
        "CAROLINA DAY": "https://nclottery.com/Site/GFX/NCEL_Alt.svg",
        "CAROLINA EVENING": "https://nclottery.com/Site/GFX/NCEL_Alt.svg",
        "CHELSEA 11": "https://chelseapools.co.uk/assets/img/chelseaPools_logo.png",
        "CHELSEA 15": "https://chelseapools.co.uk/assets/img/chelseaPools_logo.png",
        "CHELSEA 19": "https://chelseapools.co.uk/assets/img/chelseaPools_logo.png",
        "CHELSEA 21": "https://chelseapools.co.uk/assets/img/chelseaPools_logo.png",
        "FLORIDA EVENING": "https://cdn.areabermain.club/assets/cdn/az4/2024/08/11/20240811/a3e564ccb04c2b751ad4fa88c06e39c1/1-removebg-preview.png",
        "FLORIDA MIDDAY": "https://cdn.areabermain.club/assets/cdn/az4/2024/08/11/20240811/a3e564ccb04c2b751ad4fa88c06e39c1/1-removebg-preview.png",
        "HONGKONG": "https://cdn.areabermain.club/assets/cdn/az2/2024/12/01/20241201/a95376101165db91cfcd742f66dd8564/hklott.png",
        "HUAHIN 0100": "https://huahinlottery.com/assets/img/logo.png",
        "HUAHIN 1630": "https://huahinlottery.com/assets/img/logo.png",
        "HUAHIN 2100": "https://huahinlottery.com/assets/img/logo.png",
        "KENTUCKY EVENING": "https://cdn.areabermain.club/assets/cdn/az4/2024/08/11/20240811/a5fafa0102d98ab3959ceb9bb1045729/kl-logo.png",
        "KENTUCKY MIDDAY": "https://cdn.areabermain.club/assets/cdn/az4/2024/08/11/20240811/a5fafa0102d98ab3959ceb9bb1045729/kl-logo.png",
        "MAGNUM4D": "https://cdn.areabermain.club/assets/cdn/az4/2024/08/11/20240811/8889f1c5fc738b5148145100c08a0ebc/439-4390693-magnum-pengeluaran-magnum-4d-hari-clipart-removebg-preview.png",
        "NEVADA": "https://www.nevadalottery.us/images/logo.gif",
        "NEWYORK EVENING": "https://edit.nylottery.ny.gov/sites/default/files/logo-2179655b4229a219a9305b3f0e734bd0.png",
        "NEWYORK MIDDAY": "https://edit.nylottery.ny.gov/sites/default/files/logo-2179655b4229a219a9305b3f0e734bd0.png",
        "OREGON03": "https://cdn.areabermain.club/assets/cdn/az9/2024/11/26/20241126/0a72e6fa9a2d4ee4106678a8aeeab33624/favpng-oregon-lottery-video-lottery-terminal-game.png",
        "OREGON06": "https://cdn.areabermain.club/assets/cdn/az9/2024/11/26/20241126/0a72e6fa9a2d4ee4106678a8aeeab33624/favpng-oregon-lottery-video-lottery-terminal-game.png",
        "OREGON09": "https://cdn.areabermain.club/assets/cdn/az9/2024/11/26/20241126/0a72e6fa9a2d4ee4106678a8aeeab33624/favpng-oregon-lottery-video-lottery-terminal-game.png",
        "OREGON12": "https://cdn.areabermain.club/assets/cdn/az9/2024/11/26/20241126/0a72e6fa9a2d4ee4106678a8aeeab33624/favpng-oregon-lottery-video-lottery-terminal-game.png",
        "PCSO": "https://pcso.gov.ph/Images/Logos/PCSO_Logo.png",
        "POIPET 12": "https://poipetpools.com/assets/img/poipet_logo.png",
        "POIPET 15": "https://poipetpools.com/assets/img/poipet_logo.png",
        "POIPET 19": "https://poipetpools.com/assets/img/poipet_logo.png",
        "POIPET 22": "https://poipetpools.com/assets/img/poipet_logo.png",
        "SINGAPORE": "https://cdn.areabermain.club/assets/cdn/az9/2024/11/26/20241126/651f502072e9d29074094a4066928e35/sgpools.png",
        "SYDNEY": "https://sydneypoolstoday.com/assets/img/sydneypoolstoday.png",
        "TOTO CAMBODIA": "https://cdn.areabermain.club/assets/cdn/az4/2024/08/11/20240811/f07d4e2a6517ef1cea9e2a897e4abb98/cambodia-draw.png",
        "TOTOMACAU PAGI": "https://cdn.areabermain.club/assets/cdn/az2/2024/12/01/20241201/f70c3022131972b7a83d6a690e54284d/toto-macau-logo.png",
        "TOTOMACAU SIANG": "https://cdn.areabermain.club/assets/cdn/az2/2024/12/01/20241201/f70c3022131972b7a83d6a690e54284d/toto-macau-logo.png",
        "TOTOMACAU SORE": "https://cdn.areabermain.club/assets/cdn/az2/2024/12/01/20241201/f70c3022131972b7a83d6a690e54284d/toto-macau-logo.png",
        "TOTOMACAU MALAM I": "https://cdn.areabermain.club/assets/cdn/az2/2024/12/01/20241201/f70c3022131972b7a83d6a690e54284d/toto-macau-logo.png",
        "TOTOMACAU MALAM II": "https://cdn.areabermain.club/assets/cdn/az2/2024/12/01/20241201/f70c3022131972b7a83d6a690e54284d/toto-macau-logo.png",
        "TOTOMACAU MALAM III": "https://cdn.areabermain.club/assets/cdn/az2/2024/12/01/20241201/f70c3022131972b7a83d6a690e54284d/toto-macau-logo.png",
    };

    const syairList = [
        "Naga tidur di lautan biru. Waspadai angka kembar 33.",
        "Ayam jago berkokok di pagi hari. Cari pasangan 4 dan 9.",
        "Bunga mawar merah mekar di malam hari. Hati-hati dengan angka besar.",
        "Lima jari menunjuk ke langit. Jangan lupakan angka 50/51.",
        "Keberuntungan datang dari arah timur. Angka 8 adalah kunci.",
        "Angka berlari, hati berdebar, dalam keramaian, kita menanti keberuntungan."
    ];

    function getUniqueDigits(str) {
        return Array.from(new Set(str.split('').filter(d => !isNaN(parseInt(d))))).join('');
    }

    function generateCombinations(source, length, count) {
        const combinations = new Set();
        if (source.length >= length) {
            for (let i = 0; i <= source.length - length; i++) {
                combinations.add(source.substring(i, i + length));
                if (combinations.size >= count) break;
            }
        }
        const sourceChars = source.split('');
        while (combinations.size < count) {
            let combo = '';
            for (let i = 0; i < length; i++) {
                combo += sourceChars[Math.floor(Math.random() * sourceChars.length)];
            }
            if (combo.length === length) {
                combinations.add(combo);
            }
        }
        return Array.from(combinations).slice(0, count).join(' / ');
    }

    function generateTwinNumbers(source = null) {
        const digits = new Set();
        const sourceStr = source && source.length > 1 ? source : '0123456789';
        while (digits.size < 2) {
            const d = sourceStr[Math.floor(Math.random() * sourceStr.length)];
            digits.add(d);
        }
        const [d1, d2] = Array.from(digits);
        return `${d1}${d1} / ${d2}${d2}`;
    }

    function generateUniqueRandomNumber(length) {
        let result = '';
        const characters = '0123456789';
        const used = new Set();
        for (let i = 0; i < length; i++) {
            let char;
            do {
                char = characters.charAt(Math.floor(Math.random() * characters.length));
            } while (used.has(char) && length <= 10);
            used.add(char);
            result += char;
        }
        return result;
    }

    function generateFiveDigitUniqueNumber() {
        return generateUniqueRandomNumber(5);
    }

    function generateMultipleSelections(generator, count) {
        const selections = new Set();
        while (selections.size < count) {
            selections.add(generator());
        }
        return Array.from(selections);
    }

    function getTodayDate() {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return now.toLocaleDateString('id-ID', options);
    }

    function getRandomSyair() {
        const randomIndex = Math.floor(Math.random() * syairList.length);
        return syairList[randomIndex];
    }

    function initSelectOptions() {
        const pasaranSelect = document.getElementById('pasaranSelect');
        if (!pasaranSelect) return;
        pasaranSelect.innerHTML = '<option value="" disabled selected>-- Pilih Pasaran --</option>';
        pasarans.forEach(p => {
            const option = document.createElement('option');
            option.value = p;
            option.textContent = p;
            pasaranSelect.appendChild(option);
        });
    }

    function displayPredictionsSingle(pasaran, predictions, generationSource) {
        const predictionContainer = document.getElementById('predictionSingleContainer');
        predictionContainer.innerHTML = '';
        predictionContainer.style.display = 'block';

        const header = document.createElement('div');
        header.className = 'market-header-prediction';
        const logoUrl = marketLogos[pasaran] || 'https://cdn-icons-png.flaticon.com/512/3069/3069188.png';
        const logoImg = document.createElement('img');
        logoImg.className = 'prediction-market-logo';
        logoImg.src = logoUrl;
        logoImg.onerror = () => { logoImg.src = 'https://cdn-icons-png.flaticon.com/512/3069/3069188.png'; };

        const marketName = document.createElement('h2');
        marketName.className = 'market-name-prediction';
        marketName.textContent = pasaran;

        header.appendChild(logoImg);
        header.appendChild(marketName);
        predictionContainer.appendChild(header);

        const dateBadge = document.createElement('div');
        dateBadge.className = 'date-badge';
        dateBadge.textContent = `ðŸ“… ${getTodayDate()}`;
        predictionContainer.appendChild(dateBadge);

        const subtitle = document.createElement('p');
        subtitle.style.color = 'var(--text-muted)';
        subtitle.style.fontSize = '0.9em';
        subtitle.style.marginTop = '10px';
        subtitle.textContent = generationSource === 'Manual Generation' ? 'Angka Dibuat dari Input Anda. Tetap utamakan prediksi sendiri.' : 'Angka Prediksi Otomatis Hari Ini. Selalu utamakan prediksi sendiri.';
        predictionContainer.appendChild(subtitle);

        const predictionsGrid = document.createElement('div');
        predictionsGrid.className = 'prediction-results-grid';
        predictionContainer.appendChild(predictionsGrid);

        predictions.forEach((prediction) => {
            const item = document.createElement('div');
            item.className = 'prediction-item';
            if (prediction.label.includes('BBFS') || prediction.label.includes('Angka Ikut')) item.classList.add('highlight');
            if (prediction.label === 'Syair') item.classList.add('syair-item');

            let icon = '';
            switch (prediction.label) {
                case 'Tanggal': icon = 'ðŸ“…'; break;
                case 'BBFS Kuat': icon = 'ðŸŽ²'; break;
                case 'Angka Ikut': icon = 'ðŸ‘‰'; break;
                case '4D (BB)': icon = 'â­'; break;
                case '3D (BB)': icon = 'ðŸ†'; break;
                case '2D (BB)': icon = 'ðŸ…'; break;
                case 'Colok Bebas': icon = 'ðŸ’°'; break;
                case 'Colok Macau': icon = 'ðŸª™'; break;
                case 'Twin (BB)': icon = 'ðŸ’Ž'; break;
                case 'Syair': icon = 'ðŸ“œ'; break;
            }

            if (prediction.label === 'Syair') {
                item.innerHTML = `<p class="syair-text">${icon} ${prediction.value}</p>`;
            } else {
                item.innerHTML = `<div class="prediction-item-label">${icon} ${prediction.label}</div><div class="prediction-item-value">${prediction.value}</div>`;
            }
            predictionsGrid.appendChild(item);
        });

        const generateButton = document.getElementById('generatePredictionBtn');
        if (generateButton) {
            generateButton.innerHTML = '<span class="btn-icon">ðŸ”®</span> LIHAT PREDIKSI';
            generateButton.disabled = false;
        }
        predictionContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    window.generatePredictions = function () {
        const pasaranSelect = document.getElementById('pasaranSelect');
        const predictionContainer = document.getElementById('predictionSingleContainer');
        const loadingMessage = document.getElementById('loadingMessage');
        const selectedPasaran = pasaranSelect.value;
        if (!selectedPasaran) {
            showToast('âš ï¸ Silakan pilih pasaran togel terlebih dahulu!', 'error');
            return;
        }
        document.getElementById('manualError').style.display = 'none';
        predictionContainer.style.display = 'none';
        loadingMessage.style.display = 'block';
        const generateButton = document.getElementById('generatePredictionBtn');
        if (generateButton) {
            generateButton.innerHTML = '<span class="btn-icon">â³</span> Membuat Angka...';
            generateButton.disabled = true;
        }
        setTimeout(() => {
            loadingMessage.style.display = 'none';
            const predictions = [
                { label: 'Tanggal', value: getTodayDate() },
                { label: 'BBFS Kuat', value: generateUniqueRandomNumber(7) },
                { label: 'Angka Ikut', value: generateFiveDigitUniqueNumber() },
                { label: '4D (BB)', value: generateMultipleSelections(() => generateUniqueRandomNumber(4), 5).join(' / ') },
                { label: '3D (BB)', value: generateMultipleSelections(() => generateUniqueRandomNumber(3), 4).join(' / ') },
                { label: '2D (BB)', value: generateMultipleSelections(() => generateUniqueRandomNumber(2), 10).join(' / ') },
                { label: 'Colok Bebas', value: generateMultipleSelections(() => generateUniqueRandomNumber(1), 2).join(' / ') },
                { label: 'Colok Macau', value: generateMultipleSelections(() => generateUniqueRandomNumber(2), 3).join(' / ') },
                { label: 'Twin (BB)', value: generateTwinNumbers() },
                { label: 'Syair', value: getRandomSyair() }
            ];
            displayPredictionsSingle(selectedPasaran, predictions, 'Random Generation');
        }, 1500);
    }

    window.manualGenerate = function () {
        const pasaranSelect = document.getElementById('pasaranSelect');
        const inputElement = document.getElementById('manualNumberInput');
        const manualError = document.getElementById('manualError');
        const predictionContainer = document.getElementById('predictionSingleContainer');
        const selectedPasaran = pasaranSelect.value;
        const userInput = inputElement.value.trim();
        manualError.style.display = 'none';
        if (!/^\d+$/.test(userInput)) {
            manualError.textContent = 'âŒ Input hanya boleh berisi angka.';
            manualError.style.display = 'block';
            return;
        }
        if (userInput.length < 4) {
            manualError.textContent = 'âŒ Masukkan minimal 4 digit angka.';
            manualError.style.display = 'block';
            return;
        }
        if (!selectedPasaran) {
            showToast('âš ï¸ Pilih Pasaran Togel terlebih dahulu!', 'error');
            return;
        }
        predictionContainer.innerHTML = '';
        predictionContainer.style.display = 'block';
        let uniqueInput = getUniqueDigits(userInput);
        let sourceDigits = uniqueInput;
        if (uniqueInput.length < 7) {
            const allDigits = '0123456789';
            for (const char of allDigits) {
                if (!sourceDigits.includes(char) && sourceDigits.length < 7) sourceDigits += char;
            }
        } else {
            sourceDigits = uniqueInput.substring(0, 7);
        }
        const predictions = [
            { label: 'Tanggal', value: getTodayDate() },
            { label: 'BBFS Kuat', value: sourceDigits },
            { label: 'Angka Ikut', value: uniqueInput.substring(0, 5) },
            { label: '4D (BB)', value: generateCombinations(userInput, 4, 5) },
            { label: '3D (BB)', value: generateCombinations(userInput, 3, 4) },
            { label: '2D (BB)', value: generateCombinations(userInput, 2, 10) },
            { label: 'Colok Bebas', value: uniqueInput.substring(0, 2).split('').join(' / ') || generateUniqueRandomNumber(1) + ' / ' + generateUniqueRandomNumber(1) },
            { label: 'Colok Macau', value: generateCombinations(uniqueInput, 2, 3) },
            { label: 'Twin (BB)', value: generateTwinNumbers(uniqueInput) },
            { label: 'Syair', value: getRandomSyair() }
        ];
        displayPredictionsSingle(selectedPasaran, predictions, 'Manual Generation');
    }

    window.initPrediction = function () {
        if (predictionInitialized) return;
        initSelectOptions();
        const manualNumberInput = document.getElementById('manualNumberInput');
        const manualGenerateBtn = document.getElementById('manualGenerateBtn');
        const generatePredictionBtn = document.getElementById('generatePredictionBtn');
        if (manualGenerateBtn) manualGenerateBtn.onclick = manualGenerate;
        if (generatePredictionBtn) generatePredictionBtn.onclick = generatePredictions;
        if (manualNumberInput) {
            manualNumberInput.onkeypress = (e) => { if (e.key === 'Enter') manualGenerate(); };
        }
        predictionInitialized = true;
    }
})();
// =======================================================
// --- SISTEM PANDUAN BERMAIN TOGEL ---
// =======================================================
(function () {
    const guides = [
        "1.1 Cara Bet 4D 3D 2D", "1.2 Cara Bet Bb", "1.3 Cara Bet Bbfs (Bb Campuran)",
        "1.4 Cara Bet Angka Tarung", "1.5 Cara Bet Fast 4D", "1.6 Cara Bet 4D, 3D, 2D Easy",
        "1.7 Cara Bet 3D", "1.8 Cara Bet 2D Belakang", "1.9 Cara Bet 2D Depan",
        "2.0 Cara Bet 2D Tengah", "2.1 Cara Bet Colok Bebas", "2.2 Cara Bet Colok Bebas 2D",
        "2.3 Cara Bet Colok Naga", "2.4 Cara Bermain Dan Pengertian Colok Jitu",
        "2.5 Cara Bermain Tengah Tepi", "2.6 Cara Bermain Togel Menu Bet [Dasar]",
        "2.7 Cara Bermain Dan Bet Togel 50-50", "2.8 Cara Betting Shio",
        "2.9 Seputaran Pengertian Dan Cara Bermain Silang Homo",
        "3.0 Seputaran Pengertian Dan Cara Bermain Kembang Kempis",
        "3.1 Seputaran Pengertian Dan Cara Bermain Kombinasi"
    ];

    const guideImages = {
        "1.1 Cara Bet 4D 3D 2D": "https://i.imgur.com/sAT9he1.png",
        "1.2 Cara Bet Bb": "https://i.imgur.com/4uosxH1.png",
        "1.3 Cara Bet Bbfs (Bb Campuran)": "https://i.imgur.com/fzw0OQl.png",
        "1.4 Cara Bet Angka Tarung": "https://i.imgur.com/uctIKzf.png",
        "1.5 Cara Bet Fast 4D": "https://i.imgur.com/Q50jW4e.png",
        "1.6 Cara Bet 4D, 3D, 2D Easy": "https://i.imgur.com/XHfBtfL.png",
        "1.7 Cara Bet 3D": "https://i.imgur.com/uJFQarG.png",
        "1.8 Cara Bet 2D Belakang": "https://i.imgur.com/7gyU5lO.png",
        "1.9 Cara Bet 2D Depan": "https://i.imgur.com/Wh9LLZH.png",
        "2.0 Cara Bet 2D Tengah": "https://i.imgur.com/3HjkZCu.png",
        "2.1 Cara Bet Colok Bebas": "https://i.imgur.com/a4NHaIk.png",
        "2.2 Cara Bet Colok Bebas 2D": "https://i.imgur.com/qtxc3tv.png",
        "2.3 Cara Bet Colok Naga": "https://i.imgur.com/JNCWCqu.png",
        "2.4 Cara Bermain Dan Pengertian Colok Jitu": "https://i.imgur.com/n39qLYT.png",
        "2.5 Cara Bermain Tengah Tepi": "https://i.imgur.com/E54ZOyy.png",
        "2.6 Cara Bermain Togel Menu Bet [Dasar]": "https://i.imgur.com/gBLLJlh.png",
        "2.7 Cara Bermain Dan Bet Togel 50-50": "https://i.imgur.com/fT8OwHk.png",
        "2.8 Cara Betting Shio": "https://i.imgur.com/XUmmNBE.png",
        "2.9 Seputaran Pengertian Dan Cara Bermain Silang Homo": "https://i.imgur.com/jW3gHDi.png",
        "3.0 Seputaran Pengertian Dan Cara Bermain Kembang Kempis": "https://i.imgur.com/1ZG3LGW.png",
        "3.1 Seputaran Pengertian Dan Cara Bermain Kombinasi": "https://i.imgur.com/p6wPJon.png"
    };

    const guideSelect = document.getElementById('guideSelect');
    const viewGuideBtn = document.getElementById('viewGuideBtn');
    const loadingContainer = document.getElementById('loadingContainer');
    const guideContainer = document.getElementById('guideContainer');
    const guideTitle = document.getElementById('guideTitle');
    const guideImage = document.getElementById('guideImage');
    const copyImageBtn = document.getElementById('copyImageBtn');
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const openModalBtn = document.getElementById('openModalBtn');
    const imageModal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalZoomInBtn = document.getElementById('modalZoomInBtn');
    const modalZoomOutBtn = document.getElementById('modalZoomOutBtn');
    const modalResetBtn = document.getElementById('modalResetBtn');
    const fancyNotification = document.getElementById('successNotification');

    let currentScale = 1;
    let modalScale = 1;
    const minScale = 0.5;
    const maxScale = 5;
    let isDragging = false;
    let startX, startY, translateX = 0, translateY = 0;
    let touchStartDistance = 0;
    let lastModalScale = 1;

    function showFancyNotification() {
        if (!fancyNotification) return;

        fancyNotification.classList.remove('show-notification');
        void fancyNotification.offsetWidth; // Trigger reflow
        fancyNotification.classList.add('show-notification');

        setTimeout(() => {
            fancyNotification.classList.remove('show-notification');
        }, 3000);
    }

    function showFancyErrorNotification(message) {
        if (typeof showToast === 'function') {
            showToast(message, 'error');
        } else {
            alert(message);
        }
    }

    function initializeSelect() {
        if (!guideSelect) return;
        guideSelect.innerHTML = '<option value="" disabled selected>-- Pilih Jenis Panduan --</option>';
        guides.forEach(guide => {
            const option = document.createElement('option');
            option.value = guide;
            option.textContent = guide;
            guideSelect.appendChild(option);
        });
    }

    function showGuide() {
        const selectedGuide = guideSelect.value;
        if (!selectedGuide) {
            showFancyErrorNotification('âš ï¸ Silakan pilih panduan yang ingin dilihat terlebih dahulu!');
            return;
        }

        currentScale = 1;
        if (guideImage) {
            guideImage.style.transform = `scale(${currentScale})`;
            guideImage.style.transition = 'none';

            openModalBtn.style.display = 'inline-block';
            copyImageBtn.style.display = 'inline-block';
            zoomInBtn.style.display = 'inline-block';
            zoomOutBtn.style.display = 'inline-block';
            zoomInBtn.disabled = false;
            zoomOutBtn.disabled = true;
        }

        if (loadingContainer) loadingContainer.style.display = 'block';
        if (guideContainer) guideContainer.style.display = 'none';

        setTimeout(() => {
            if (guideTitle) guideTitle.textContent = selectedGuide;
            if (guideImage) {
                guideImage.src = guideImages[selectedGuide];
                guideImage.alt = selectedGuide;
            }

            if (loadingContainer) loadingContainer.style.display = 'none';
            if (guideContainer) {
                guideContainer.style.display = 'block';

                guideContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 500);
    }

    function copyImageToClipboard() {
        const selectedGuide = guideSelect.value;
        if (!selectedGuide) return;

        const imageUrl = guideImages[selectedGuide];

        navigator.clipboard.writeText(imageUrl).then(() => {
            showFancyNotification();
        }).catch(err => {
            console.error('Gagal menyalin URL: ', err);
            showFancyErrorNotification('âŒ Gagal menyalin URL.');
        });
    }

    function zoomIn() {
        if (!guideImage) return;
        if (currentScale < maxScale) {
            currentScale = Math.min(maxScale, currentScale + 0.2);
            guideImage.style.transform = `scale(${currentScale})`;
            guideImage.style.transition = 'transform 0.2s ease';
        }
        if (zoomOutBtn) zoomOutBtn.disabled = false;
        if (zoomInBtn) zoomInBtn.disabled = currentScale >= maxScale;
    }

    function zoomOut() {
        if (!guideImage) return;
        if (currentScale > 1.0) {
            currentScale = Math.max(1.0, currentScale - 0.2);
            guideImage.style.transform = `scale(${currentScale})`;
            guideImage.style.transition = 'transform 0.2s ease';
        }
        if (zoomInBtn) zoomInBtn.disabled = false;
        if (zoomOutBtn) zoomOutBtn.disabled = currentScale <= 1.0;
    }

    function openModal(url, title) {
        const modal = document.getElementById('imageModal');
        const img = document.getElementById('modalImage');
        if (!modal || !img) return;

        if (url && typeof url === 'string') {
            img.src = url;
            img.alt = title || 'Preview';
        } else {
            const selectedGuide = guideSelect.value;
            if (!selectedGuide) return;
            img.src = guideImages[selectedGuide];
            img.alt = selectedGuide;
        }

        modalScale = 1;
        translateX = 0;
        translateY = 0;
        img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${modalScale})`;
        img.style.transition = 'none';
        img.style.cursor = 'zoom-in';

        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        if (imageModal) imageModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    function modalZoomIn() {
        if (!modalImage) return;
        if (modalScale < maxScale) {
            modalScale = Math.min(maxScale, modalScale + 0.3);
            modalImage.style.transform = `translate(${translateX}px, ${translateY}px) scale(${modalScale})`;
            modalImage.style.transition = 'transform 0.2s ease';
        }
        if (modalScale > 1.0) modalImage.style.cursor = 'grab';
    }

    function modalZoomOut() {
        if (!modalImage) return;
        if (modalScale > minScale) {
            modalScale = Math.max(minScale, modalScale - 0.3);
            modalImage.style.transform = `translate(${translateX}px, ${translateY}px) scale(${modalScale})`;
            modalImage.style.transition = 'transform 0.2s ease';
        }
        if (modalScale <= 1.0) {
            resetModalZoom();
        }
    }

    function resetModalZoom() {
        if (!modalImage) return;
        modalScale = 1;
        translateX = 0;
        translateY = 0;
        modalImage.style.transform = `translate(${translateX}px, ${translateY}px) scale(${modalScale})`;
        modalImage.style.transition = 'transform 0.3s ease';
        modalImage.style.cursor = 'zoom-in';
    }

    function startDrag(e) {
        if (!modalImage) return;
        if (modalScale <= 1 && !e.touches) return;
        if (e.touches && e.touches.length > 1) return;

        isDragging = true;
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;

        startX = clientX - translateX;
        startY = clientY - translateY;
        modalImage.style.cursor = 'grabbing';
        e.preventDefault();
    }

    function drag(e) {
        if (!isDragging || !modalImage) return;
        e.preventDefault();
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;

        translateX = clientX - startX;
        translateY = clientY - startY;

        modalImage.style.transform = `translate(${translateX}px, ${translateY}px) scale(${modalScale})`;
        modalImage.style.transition = 'none';
    }

    function stopDrag() {
        if (!modalImage) return;
        isDragging = false;
        if (modalScale > 1.0) {
            modalImage.style.cursor = 'grab';
        } else {
            modalImage.style.cursor = 'zoom-in';
            if (modalScale <= 1.0) resetModalZoom();
        }
    }

    function initGuide() {
        initializeSelect();

        if (viewGuideBtn) viewGuideBtn.addEventListener('click', showGuide);
        if (guideSelect) guideSelect.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') showGuide();
        });
        if (copyImageBtn) copyImageBtn.addEventListener('click', copyImageToClipboard);
        if (zoomInBtn) zoomInBtn.addEventListener('click', zoomIn);
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', zoomOut);
        if (openModalBtn) openModalBtn.addEventListener('click', openModal);
        if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
        if (modalZoomInBtn) modalZoomInBtn.addEventListener('click', modalZoomIn);
        if (modalZoomOutBtn) modalZoomOutBtn.addEventListener('click', modalZoomOut);
        if (modalResetBtn) modalResetBtn.addEventListener('click', resetModalZoom);

        if (modalImage) {
            modalImage.addEventListener('touchend', (e) => {
                stopDrag();
                if (modalScale <= 1.0) {
                    resetModalZoom();
                } else if (modalScale > 1.0) {
                    modalImage.style.cursor = 'grab';
                }
            });
        }

        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);

        if (imageModal) imageModal.addEventListener('click', (e) => {
            if (e.target === imageModal) {
                closeModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && imageModal && imageModal.style.display === 'block') {
                closeModal();
            }
        });
    }

    initGuide();

    // Ekspor fungsi untuk digunakan di main.js
    window.initGuide = initGuide;
    window.openImageModal = openModal;
})();

// --- CEK DATA REKENING LOGIC ---
function initRekeningChecker() {
    console.log('CEK DATA REKENING App Initialized');

    const processBtn = document.getElementById('processBtn');
    const accountInput = document.getElementById('accountInput');
    const statusMessage = document.getElementById('statusMessage');

    // UI Elements for Copy
    const copyFoundBtn = document.getElementById('copyFoundBtn');
    const copyNotFoundBtn = document.getElementById('copyNotFoundBtn');
    const clearBtn = document = document.getElementById('clearBtn');

    // Google Apps Script Web App URL - Defined globally or locally
    // The user provided a specific URL in their snippet, we use that or the global one if they match.
    // user URL: https://script.google.com/macros/s/AKfycbyyfs13PWqUdeBg5yWg4Km4_q-_QhnuNFBV-Upq-K6HzMRvi900jTwg3UG6rvLY4lbY/exec
    const API_URL = REKENING_API_URL || 'https://script.google.com/macros/s/AKfycbyyfs13PWqUdeBg5yWg4Km4_q-_QhnuNFBV-Upq-K6HzMRvi900jTwg3UG6rvLY4lbY/exec';

    let database = []; // Store combined data { account, source, details }

    // Helper to show status
    function showStatus(message, type) {
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.className = 'status-msg'; // Reset class

        if (type === 'error') {
            statusMessage.style.color = '#ff4d4d';
            statusMessage.classList.add('text-danger');
        } else if (type === 'success') {
            statusMessage.style.color = '#2ecc71';
            statusMessage.classList.add('text-success');
        } else {
            statusMessage.style.color = '#3498db';
        }
    }

    // Auto-fetch data on load
    fetchDatabase();

    function fetchDatabase() {
        showStatus('Menghubungkan ke database cloud...', 'info');

        fetch(API_URL)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(result => {
                if (result.status === 'success') {
                    // The user's snippet expected 'data' to be the array of records directly?
                    // Or maybe result.data is the array. 
                    // Let's assume result.data is the array of objects as per standard.
                    // WAIT: The user's snippet had logic to process "workbook" in a function 'processWorkbook' but that function 
                    // was never called in the fetch block in their snippet! 
                    // ACTUAL SNIPPET LOGIC:
                    // fetch -> result
                    // if result.status === 'success' -> database = result.data
                    // showStatus 'Connected... result.total data'

                    // So the server must return already processed JSON data, NOT a workbook.
                    // The 'processWorkbook' function in the snippet seemed unused or for a different file upload context?
                    // Ah, looking closely at the user request:
                    // "function processWorkbook(workbook) { ... }" exists BUT it is NOT called in 'fetchDatabase'.
                    // 'fetchDatabase' sets 'database = result.data'.
                    // So we assume the API returns the cleaner JSON. 
                    // If the API returns a raw Excel file (blob), then we would need SheetJS and processWorkbook.
                    // Given the URL is a GAS Exec, it likely returns JSON.

                    database = result.data || [];
                    const total = result.total || database.length;
                    showStatus(`✅ Terhubung ke Cloud! ${total} data siap.`, 'success');
                } else {
                    throw new Error('Format data tidak valid: ' + (result.message || 'Unknown error'));
                }
            })
            .catch(error => {
                console.error('Fetch Error:', error);
                showStatus('Gagal koneksi cloud: ' + error.message, 'error');
            });
    }

    // The user snippet had a 'processWorkbook' function, but it seems specific to parsing an Excel file (XLSX). 
    // If the API returns JSON, we don't need it. 
    // However, if the user intends to upload a file *locally* later, we might need it.
    // The current UI doesn't have a file upload button for this section, only input text.
    // I will include the logic just in case, but commented out or unused unless needed.

    function processData() {
        if (!database || database.length === 0) {
            showStatus('Database belum siap atau kosong. Tunggu sebentar...', 'error');
            return;
        }

        const rawData = accountInput.value.trim();
        const foundTbody = document.querySelector('#foundTable tbody');
        const notFoundTbody = document.querySelector('#notFoundTable tbody');

        // Safety check if elements exist
        if (!foundTbody || !notFoundTbody) {
            console.error('Table bodies not found!');
            return;
        }

        // If input is empty
        if (!rawData) {
            foundTbody.innerHTML = '<tr class="empty-row"><td colspan="2">Menunggu data...</td></tr>';
            notFoundTbody.innerHTML = '<tr class="empty-row"><td colspan="2">Tidak ada data error</td></tr>';
            return;
        }

        const lines = rawData.split('\n').filter(line => line.trim() !== '');

        // Clear previous results
        foundTbody.innerHTML = '';
        notFoundTbody.innerHTML = '';

        let foundCount = 0;
        let notFoundCount = 0;

        lines.forEach(line => {
            // Basic clean
            let searchKey = line.trim();

            // Smart Extraction: Look for sequence of 9+ digits (phones/accounts) if mixed with text
            // If the line is JUST numbers, it keeps it.
            const numberMatch = searchKey.match(/(\d{9,})/);
            if (numberMatch) {
                searchKey = numberMatch[0];
            }

            // Search in database
            // The user snippet assumes record structure: { dataA, dataB, dataC, source }
            const match = database.find(record =>
                (record.dataA && String(record.dataA).includes(searchKey)) ||
                (record.dataB && String(record.dataB).includes(searchKey)) ||
                (record.dataC && String(record.dataC).includes(searchKey))
            );

            // Strict equality might be better depending on data
            // The user snippet used === in some places but typically 'includes' is safer for partial matches if intended, 
            // but for accounts usually exact match is desired. 
            // The user snippet used: record.dataA === searchKey || ... 
            // I will stick to EXACT match as per user snippet to avoid false positives (e.g. searching '123' finding '123456')
            const strictMatch = database.find(record =>
                String(record.dataA) === searchKey ||
                String(record.dataB) === searchKey ||
                String(record.dataC) === searchKey
            );

            const row = document.createElement('tr');
            row.className = 'fade-in'; // User used classList.add('fade-in')

            if (strictMatch) {
                foundCount++;

                // Formatting Logic from snippet
                let sourceName = strictMatch.source || 'Unknown';
                const upperSource = sourceName.toUpperCase();

                // Naming conventions mapping
                if (upperSource.includes('GOPAY')) { sourceName = 'E-WALLET GOPAY'; }
                else if (upperSource.includes('DANA')) { sourceName = 'E-WALLET DANA'; }
                else if (upperSource.includes('OVO')) { sourceName = 'E-WALLET OVO'; }
                else if (upperSource.includes('LINKAJA')) { sourceName = 'E-WALLET LINKAJA'; }
                else if (upperSource.includes('KAS')) { sourceName = 'BANK KAS'; }
                else if (upperSource.includes('DEPO')) { sourceName = 'BANK DEPO'; }
                else if (upperSource.includes('WD')) { sourceName = 'BANK WD'; }

                // Construct Account Name
                // We want to show the Name (usually column B) and Bank/Type
                // The snippet logic for 'accountName' was a bit complex, filtering out the keyword.
                // Let's simplify: Display DataB (Name) and Source.

                // Replicating snippet logic exactly:
                let filterKeyword = '';
                if (upperSource.includes('GOPAY')) filterKeyword = 'GOPAY';
                else if (upperSource.includes('DANA')) filterKeyword = 'DANA';
                else if (upperSource.includes('OVO')) filterKeyword = 'OVO';
                else if (upperSource.includes('LINKAJA')) filterKeyword = 'LINKAJA';

                let nameParts = [];
                [strictMatch.dataA, strictMatch.dataB, strictMatch.dataC].forEach(part => {
                    if (!part) return; // Skip null/undefined/empty
                    const p = String(part).trim();
                    if (!p || p.toLowerCase() === 'undefined') return; // Skip literal "undefined" string or empty after trim

                    // If part is not the number we searched for AND not the filter keyword
                    if (p !== searchKey) {
                        if (filterKeyword && p.toUpperCase() === filterKeyword) return;
                        nameParts.push(p);
                    }
                });

                const accountName = nameParts.length > 0 ? nameParts.join(' / ') : (strictMatch.dataB || '-'); // Fallback to B
                // const displayName = `${sourceName} / ${accountName}`;
                // User snippet used:
                // row.innerHTML = `<td>${displayName}</td><td class="badge-found">${searchKey}</td>`

                // Our design has explicit columns: JENIS BANK, NAMA REKENING, NOMOR REKENING
                // Found Table: <th>JENIS BANK</th> <th>NAMA REKENING</th> <th>NOMOR REKENING</th>
                row.innerHTML = `
                    <td style="font-weight: 700; color: #00ff75;">${sourceName}</td>
                    <td style="font-weight: 700; color: #ffffff;">${accountName}</td>
                    <td style="font-family: monospace;">${searchKey}</td>
                `;
                foundTbody.appendChild(row);
            } else {
                notFoundCount++;
                // Not Found Table: <th>INPUT</th> <th>STATUS</th>
                row.innerHTML = `
                    <td style="font-family: monospace;">${searchKey}</td>
                    <td class="text-danger" style="font-weight: 700;">TIDAK DITEMUKAN</td>
                `;
                notFoundTbody.appendChild(row);
            }
        });

        // Handle Empty States
        if (foundCount === 0) {
            foundTbody.innerHTML = '<tr class="empty-row"><td colspan="3">Tidak ada data ditemukan</td></tr>';
        }
        if (notFoundCount === 0) {
            notFoundTbody.innerHTML = '<tr class="empty-row"><td colspan="2">Semua data valid!</td></tr>';
            // If we processed input but found nothing and input wasn't empty
            if (foundCount === 0 && lines.length > 0) {
                notFoundTbody.innerHTML = ''; // Clear the 'valid' message if we actually have not found items
                // Logic check: if notFoundCount > 0, we already appended rows.
            }
            if (lines.length === 0) {
                notFoundTbody.innerHTML = '<tr class="empty-row"><td colspan="2">Tidak ada input valid</td></tr>';
            }
        }

        showStatus(`Selesai! ${foundCount} Ditemukan, ${notFoundCount} Tidak Ditemukan.`, foundCount > 0 ? 'success' : 'error');
    }

    // Auto-Process on Input (Debounced)
    let debounceTimer;
    if (accountInput) {
        accountInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(processData, 800); // 800ms delay to be safe
        });
    }

    // Manual Process
    if (processBtn) processBtn.addEventListener('click', processData);

    // Clear Logic
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            accountInput.value = '';
            const foundTbody = document.querySelector('#foundTable tbody');
            const notFoundTbody = document.querySelector('#notFoundTable tbody');

            if (foundTbody) foundTbody.innerHTML = '<tr class="empty-row"><td colspan="3">Data telah dihapus</td></tr>';
            if (notFoundTbody) notFoundTbody.innerHTML = '<tr class="empty-row"><td colspan="2">Data telah dihapus</td></tr>';

            showStatus('Input dan hasil telah dibersihkan.', 'info');
            accountInput.focus();
        });
    }

    // Generic Copy Function
    function setupCopyButton(btn, tableId) {
        if (!btn) return;
        btn.addEventListener('click', () => {
            const rows = document.querySelectorAll(`#${tableId} tbody tr`);
            if (rows.length === 0 || rows[0].classList.contains('empty-row')) {
                showStatus('Tidak ada data untuk disalin.', 'error');
                return;
            }

            let clipboardText = '';
            rows.forEach(row => {
                const cols = row.querySelectorAll('td');
                if (cols.length > 0) {
                    // Dynamically join all columns
                    const cells = Array.from(cols).map(c => c.innerText.trim());
                    clipboardText += cells.join('\t') + '\n';
                }
            });

            navigator.clipboard.writeText(clipboardText).then(() => {
                showStatus('Data berhasil disalin!', 'success');
                // Visual feedback on button
                const originalHTML = btn.innerHTML;
                btn.innerHTML = '<i class="material-icons-round">check</i>';
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                }, 1500);
            }).catch(err => {
                console.error('Copy failed:', err);
                showStatus('Gagal menyalin.', 'error');
            });
        });
    }

    setupCopyButton(copyFoundBtn, 'foundTable');
    setupCopyButton(copyNotFoundBtn, 'notFoundTable');
}

// --- GALLERY SYSTEM LOGIC ---
async function handleGalleryUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const btn = document.querySelector('button[onclick*="gallery-upload-input"]');
    const originalContent = btn.innerHTML;

    // Show loading state
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> UPLOADING...';

    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1];
        const payload = {
            action: 'uploadGalleryPhoto',
            base64: base64,
            fileName: file.name,
            mimeType: file.type
        };

        try {
            const resp = await fetch(WEB_APP_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const res = await resp.json();

            if (res.success) {
                showToast('Foto berhasil diunggah!', 'success');
                fetchGallery(); // Refresh gallery
            } else {
                showToast(res.error || 'Gagal mengunggah foto', 'error');
            }
        } catch (err) {
            console.error('Upload Error:', err);
            showToast('Kesalahan koneksi saat upload', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
            input.value = ''; // Reset input
        }
    };
    reader.readAsDataURL(file);
}

async function fetchGallery() {
    const grid = document.getElementById('gallery-grid');
    const loading = document.getElementById('gallery-loading');

    if (!grid || !loading) return;
    if (!WEB_APP_URL) return showToast('URL Web App belum diatur!', 'error');

    grid.style.display = 'none';
    loading.style.display = 'block';

    try {
        const resp = await fetch(`${WEB_APP_URL}?action=getGallery`);
        const res = await resp.json();

        if (res.success) {
            renderGallery(res.data);
        } else {
            showToast(res.error || 'Gagal memuat galeri', 'error');
        }
    } catch (e) {
        console.error('Gallery Fetch Error:', e);
        showToast('Kesalahan server galeri', 'error');
    } finally {
        loading.style.display = 'none';
        grid.style.display = 'grid';
    }
}

function renderGallery(data) {
    const grid = document.getElementById('gallery-grid');
    if (!grid) return;

    if (!data || data.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: #64748b;">Folder kosong atau tidak ditemukan file gambar.</div>';
        return;
    }

    grid.innerHTML = data.map(item => `
        <div class="gallery-item entry-anim" onclick="window.openImageModal('${item.thumbnail}', '${item.name}')">
            <img class="gallery-image" src="${item.thumbnail}" alt="${item.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x200?text=File+Preview'">
            <div class="gallery-overlay">
                <div class="gallery-name">${item.name}</div>
                <div class="gallery-actions">
                    <button class="gallery-btn" onclick="event.stopPropagation(); window.open('${item.viewUrl}', '_blank')" title="Buka Asli">
                        <i class="fas fa-external-link-alt"></i> BUKA
                    </button>
                    <button class="gallery-btn" onclick="event.stopPropagation(); window.open('${item.downloadUrl}', '_blank')" title="Unduh">
                        <i class="fas fa-download"></i> UNDUH
                    </button>
                    <button class="gallery-btn" onclick="event.stopPropagation(); navigator.clipboard.writeText('${item.viewUrl}'); showToast('URL Gambar disalin!', 'success')">
                        <i class="fas fa-copy"></i> SALIN
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// --- SLOT CALCULATOR LOGIC ---
function formatIDR(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
}



// --- CALCULATOR FREE & BUY SPIN LOGIC ---
function updateLogs() {
    const terminal = document.getElementById('terminalLog');
    if (!terminal) return;
    const logs = [
        "Scanning sector 7...",
        "Incoming transmission...",
        "Decrypting signal...",
        "Updating database...",
        "Calibrating propulsors...",
        "Signal lost...",
        "Reconnecting...",
        "Data packet received.",
        "Checking integrity...",
        "Optimizing interface..."
    ];

    setInterval(() => {
        const randomLog = logs[Math.floor(Math.random() * logs.length)];
        const now = new Date();
        const timeString = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;

        const div = document.createElement('div');
        div.className = 'log-entry';
        div.innerHTML = `<span class="log-time" style="color: #666;">${timeString}</span> ${randomLog}`;

        terminal.appendChild(div);
        terminal.scrollTop = terminal.scrollHeight;

        if (terminal.children.length > 20) {
            terminal.removeChild(terminal.firstChild);
        }
    }, 2000);
}

function calculateSpinProfit() {
    const input = document.getElementById('spinInput').value;
    const resultDisplay = document.getElementById('resultDisplay');
    const spinCountDisplay = document.getElementById('spinCountDisplay');
    if (!resultDisplay || !spinCountDisplay) return;

    const chunks = input.split('Free Spin:');
    let total = 0;
    let count = 0;

    for (let i = 1; i < chunks.length; i++) {
        const chunk = chunks[i];
        const match = chunk.match(/IDR\s+([0-9.,]+)/);
        if (match) {
            let valueStr = match[1];
            valueStr = valueStr.replace(/\./g, '').replace(',', '.');
            const value = parseFloat(valueStr);
            if (!isNaN(value)) {
                total += value;
                count++;
            }
        }
    }

    const finalTotal = total * 1000;
    const formattedTotal = finalTotal.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });

    resultDisplay.innerText = formattedTotal;
    spinCountDisplay.innerText = `Fragments Found: ${count}`;

    if (total > 0) {
        clearTimeout(window.alienSaveTimeout);
        window.alienSaveTimeout = setTimeout(() => {
            const now = new Date();
            const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
            addToHistory(timeStr, count, formattedTotal);
        }, 1500);
    }

    resultDisplay.style.textShadow = "0 0 30px var(--luxury-gold-alien)";
    setTimeout(() => {
        resultDisplay.style.textShadow = "0 0 20px rgba(212, 175, 55, 0.4)";
    }, 500);
}

function addToHistory(timeStr, count, formattedTotal) {
    const historyBody = document.getElementById('historyTableBody');
    if (!historyBody) return;
    const row = document.createElement('tr');

    row.innerHTML = `
        <td><span style="color:var(--hacker-green); font-family: 'Fira Code', monospace;">${timeStr}</span></td>
        <td>${count} Frags</td>
        <td style="color:var(--luxury-gold-alien); font-weight: bold;">${formattedTotal}</td>
    `;

    historyBody.insertBefore(row, historyBody.firstChild);

    if (historyBody.children.length > 10) {
        historyBody.removeChild(historyBody.lastChild);
    }

    saveHistoryToStorage();
}

function saveHistoryToStorage() {
    const historyBody = document.getElementById('historyTableBody');
    if (!historyBody) return;
    const rows = [];
    for (let i = 0; i < historyBody.children.length; i++) {
        const row = historyBody.children[i];
        if (row.classList.contains('empty-row')) continue;
        const cols = row.querySelectorAll('td');
        if (cols.length < 3) continue;
        rows.push({
            time: cols[0].innerText,
            count: cols[1].innerText.replace(' Frags', ''),
            total: cols[2].innerText
        });
    }
    localStorage.setItem('alienDashboardHistory', JSON.stringify(rows));
}

function loadHistory() {
    const saved = localStorage.getItem('alienDashboardHistory');
    const historyBody = document.getElementById('historyTableBody');
    if (!historyBody) return;

    if (saved) {
        const rows = JSON.parse(saved);
        if (rows.length > 0) {
            historyBody.innerHTML = '';
            rows.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><span style="color:var(--hacker-green); font-family: 'Fira Code', monospace;">${item.time}</span></td>
                    <td>${item.count} Frags</td>
                    <td style="color:var(--luxury-gold-alien); font-weight: bold;">${item.total}</td>
                `;
                historyBody.appendChild(row);
            });
        }
    }
}

function resetData() {
    const spinInput = document.getElementById('spinInput');
    const resultDisplay = document.getElementById('resultDisplay');
    const spinCountDisplay = document.getElementById('spinCountDisplay');

    if (spinInput) spinInput.value = '';
    if (resultDisplay) {
        resultDisplay.innerText = '0.00';
        resultDisplay.style.textShadow = "none";
    }
    if (spinCountDisplay) spinCountDisplay.innerText = 'DATA FRAGMENTS: 0';

    document.getElementById('limitB').value = '';
    document.getElementById('awardB').value = '';
    calculateSubtraction('limit');
    calculateSubtraction('award');
    showToast('System Reset Complete', 'success');
}

function resetHistory() {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.style.display = 'none';
}

function confirmClearHistory() {
    localStorage.removeItem('alienDashboardHistory');
    const historyBody = document.getElementById('historyTableBody');
    if (historyBody) historyBody.innerHTML = '<tr class="empty-row"><td colspan="3">Waiting for data fragments...</td></tr>';
    closeModal();
    showToast('Logs Purged Successfully', 'success');
}

function formatNominal(input) {
    // Remove all non-digit characters
    let value = input.value.replace(/[^0-9]/g, '');
    if (value) {
        // Format with thousands separators (US locale for comma)
        input.value = parseInt(value).toLocaleString('en-US');
    } else {
        input.value = '';
    }
}

function calculateSubtraction(type) {
    const elA = document.getElementById(`${type}A`);
    const elB = document.getElementById(`${type}B`);
    if (!elA || !elB) return;

    // Strip commas before parsing to float
    const valA = parseFloat(elA.value.replace(/,/g, '')) || 0;
    const valB = parseFloat(elB.value.replace(/,/g, '')) || 0;
    const resultElement = document.getElementById(`${type}Result`);
    if (!resultElement) return;

    const diff = valA - valB;
    const formattedDiff = diff.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });

    resultElement.innerText = formattedDiff;
}

function initiateSequence() {
    const btn = document.querySelector('.btn-alien');
    if (!btn) return;
    const originalText = btn.innerText;

    btn.innerText = "ACCESSING...";
    btn.style.background = "#D4AF37";
    btn.style.color = "#000";

    setTimeout(() => {
        btn.innerText = "ACCESS GRANTED";
        btn.style.background = "#00FF41";

        setTimeout(() => {
            showToast("Sistem diaktifkan! Selamat datang, Komandan.", "success");
            btn.innerText = originalText;
            btn.style.background = "";
            btn.style.color = "";
        }, 800);
    }, 1500);
}

// Custom Cursor & Matrix Effects
function initAlienVisuals() {
    const canvas = document.getElementById('matrixCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cursorDot = document.querySelector('.cursor-dot');
    const cursorOutline = document.querySelector('.cursor-outline');

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$£€¥@#&%";
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops = [];
    for (let i = 0; i < columns; i++) drops[i] = 1;

    function drawMatrix() {
        ctx.fillStyle = "rgba(5, 5, 5, 0.05)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = fontSize + "px 'Fira Code'";

        for (let i = 0; i < drops.length; i++) {
            const text = characters.charAt(Math.floor(Math.random() * characters.length));
            ctx.fillStyle = Math.random() > 0.95 ? "#D4AF37" : "#00FF41";
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);
            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
            drops[i]++;
        }
    }
    setInterval(drawMatrix, 33);

    window.addEventListener('mousemove', (e) => {
        if (cursorDot && cursorOutline) {
            cursorDot.style.left = `${e.clientX}px`;
            cursorDot.style.top = `${e.clientY}px`;
            cursorOutline.animate({
                left: `${e.clientX}px`,
                top: `${e.clientY}px`
            }, { duration: 400, fill: "forwards" });
        }
    });
}

// Initialize Alien UI
function fetchFootballSchedule() {
    console.log("Initializing Clean Football Widget...");
    const container = document.getElementById('sofascore-widget-football-livescore');
    if (!container) return;

    // Jika skrip belum ada, tambahkan skrip resmi SofaScore
    if (!document.getElementById('sofascore-bundle-js')) {
        const script = document.createElement('script');
        script.id = 'sofascore-bundle-js';
        script.src = "https://www.sofascore.com/widgets/livescore-widget/js/bundle.js";
        script.async = true;
        document.body.appendChild(script);
    } else {
        // Jika skrip sudah ada, picu pemuatan ulang widget jika perlu
        if (window.SofaScoreWidget) {
            console.log("Widget already loaded, refreshing view...");
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('alien-command-section')) {
        updateLogs();
        loadHistory();
        initAlienVisuals();
        calculateSubtraction('limit');
        calculateSubtraction('award');
    }

});

// =======================================================
// --- BUKU MIMPI SYSTEMS ---
// =======================================================

// Rich Data Source for Buku Mimpi
const dreamBookSource = {
    "00": {
        main: "97 48 64 – 98",
        content: "Penyair – Tapir – Kupas Kelapa – Sempritan – Tanggalan – Pindah Rumah – Bulan Kumbo Karno – Kerbau – Jendral",
        pelarian: "67 ( Kerbau Jendral )",
        erek: "Pedagang (146 98), Kelapa Muda (187 – 198 )",
        kode: "Lampu Teplok Menyala, Nyiur, Semut – Tuan Tanah.",
        gaya: "10 ( Semut – Tuan Tanah )"
    },
    "01": {
        main: "05 – 95 – 12 – 45",
        content: "Setan – Ikan Bandeng – Obor – Jambu Mente – Tangan – Jual Ikan – Bacang – Betara Kala",
        pelarian: "95 ( Burung Pipit – Gerombolan Perampok )",
        erek: "Tentara = (74 – 01 ) – Silat = (144 101 )",
        kode: "Cicak Sedang Kawin – Langsat – Binatang Naga – Abdi Raja.",
        gaya: "99 ( Naga – Abdi Raja )"
    },
    "02": {
        main: "16 – 53 09 – 35",
        content: "Hantu – Ikan Bandeng – Tukang Jual Ikan – Lampu atau Api Obor Jambu Klutuk / Mente – Tangan Manusia Betara Kala – Burung Pipit Kecil – Sekumpulan Perampok",
        pelarian: "79 ( Kucing – Kas Uang )",
        erek: "Orang Barat = (163 02 ) – Mucikari = (73 -102 )",
        kode: "Kodok Masuk Rumah – Jagung – Binatang Singa – Kepala Penjahat",
        gaya: "77 ( Singa Kepala Rampo )"
    },
    "03": {
        main: "32 – 52 – 85 – 25",
        content: "Orang Mati – Binatang Angsa Lompat Galah Sayuran Hijau Sawi Sepasang Kaki – Sedang Cemburu – Subali Binatang Kupu-Kupu – Pelacur Kelas Tinggi",
        pelarian: "46 ( Kupu Kupu – Pelacur Tinggi )",
        erek: "Orang Dayak = (38 03 ) Kepala Polisi = (122 – 103 )",
        kode: "Kupu-Kupu Masuk Rumah di Malam Hari – Pohon Nipah – Badak – Penjahat / Brandalan",
        gaya: "28 ( Badak – Brandal )"
    },
    "04": {
        main: "12 – 65 – 05 15",
        content: "Dewi Kwan Im – Sepasang Balon – Sayuran Petai – Lompat Jauh – Sayuran Hijau Kangkung – Burung Merak – Membaca Buku – Dewi Ratih – Burung Kutilang – Orang / Seniman",
        pelarian: "52 ( Kutilang – Seniman )",
        erek: "Hipnotis = (162 – 04 ) – Anggar = (62 – 104 )",
        kode: "Orang Gila Sedang Ngamuk di Jalan – Jeruk Bali – Burung Elang / Rajawali – Menantu Raja",
        gaya: "88 ( Rajawali Menantu Raja )"
    },
    "05": {
        main: "01 – 89 – 10 – 39",
        content: "Raja Perampok – Singa Jantan Jemur Baju – Loncat Indah Kayu Manis – Bumbu Merica Kereta Api – Garu Langit Burung Kicau Murai – Dapat Untung Besar",
        pelarian: "17 ( Burung Murai – Untung Besar )",
        erek: "Tukang Sapu = (119 – 05 ) – Pemahat = (88 -105 )",
        kode: "Burung Elang Sedang Terbang – Pohon Durian – Angsa – Orang Meninggal",
        gaya: "32 ( Angsa – Orang Mati )"
    },
    "06": {
        main: "20 – 91 51 41",
        content: "Dewi Kawan Iama – Sepasang Balon – Sayuran Petai Lompat Jauh Sayuran Hijau Kangkung – Burung Merak – Membaca Buku – Dewi Ratih – Burung Kutilang Orang / Seniman",
        pelarian: "64 ( Naga – Raja )",
        erek: "( Penjual Sayur = 113 – 06 ) – Pelukis = 76 106 )",
        kode: "Anjing Melolong Ketika Malam Hari Manggis – Hewan Macan – Maling",
        gaya: "85 ( Macan – Maling Kecil )"
    },
    "07": {
        main: "24 – 58 – 57 – 08",
        content: "Pelayan – Hewan Babi Kapal Keruk – Perahu Layar Sayuran Bawang – memancing Batu Arang Sulastri – Hewan Kera – Setan Gantung",
        pelarian: "76 ( Kera – Setan Gantung )",
        erek: "Hipnotis = ( Ronda Malam = 89 – 07 ) – Serdadu = 147 – 107 )",
        kode: "Kucing Sedang Kawin – Pohon Kenari Hewan Kodok – Sumur Air",
        gaya: "34 ( Kodok – Sumber Air )"
    },
    "08": {
        main: "17 57 – 04 – 07",
        content: "Maling Kecil – Hewan Macan – Melanggar – Motor Atau Mesin Bot – Bunga Kecubung – Sayuran Daun Sop – Pasar – Tuan Mariam Anjing Jendral Serakah",
        pelarian: "20 ( Anjing – Jendral Serakah )",
        erek: "Pramugari = (143 – 08 ) – Ahli Nujum = (142 108 )",
        kode: "Mendengar Suara Burung Hantu – Pohon Jati – Hewan Ikan Belut – Kerajaan / Jendral",
        gaya: "40 ( Belut – Jendral )"
    },
    "09": {
        main: "33 – 87 – 88 – 37",
        content: "Jendral – Hewan Kerbau – Jala Ikan – Mendayung – Kates – Pinang – Anak Gadis – Bima – Ikan Paus – Raja Laut",
        pelarian: "24 ( Ikan Paus – Raja Laut )",
        erek: "Koki = (168 09 ) Si Bungkuk = (176 – 109 )",
        kode: "Perampok Ketangkap Polisi – Pohon Jambu – Musang Pendeta",
        gaya: "75 ( Musang Pendeta )"
    },
    "10": {
        main: "18 – 82 – 03 – 32",
        content: "Kelenteng / Vihara Kelapa – Hewan Kelabang – Rileks Minum Bir – Panjat Pohon Sedang Menyelam – Sedang Sembahyang / Pemujaan – Hewan Macan – Maling",
        pelarian: "36 ( Macan – Maling )",
        erek: "Polwan = (28 – 10 ) – Sakit Mata = (169 – 110 )",
        kode: "Tikus Lewat Depan Kita – Pepaya – Ayam Kalkun – Sang Buddha",
        gaya: "00 ( Kalkun – Budha )"
    }
};

let dreamBookInitialized = false;
function initDreamBook() {
    if (dreamBookInitialized) return;

    const grid = document.getElementById('dream-book-grid');
    if (!grid) return;

    // Generate 00-99
    for (let i = 0; i < 100; i++) {
        const numStr = i.toString().padStart(2, '0'); // 00, 01, ... 99

        const item = document.createElement('div');
        item.className = 'dream-item';
        item.setAttribute('data-num', numStr);

        const imgPath = `BUKU MIMPI/${i}.gif`;
        const data = dreamBookSource[numStr] || null;

        let detailsHtml = '';
        if (data) {
            detailsHtml = `
                <div class="dream-details">
                    <div class="dream-main-num">${data.main}</div>
                    <ul class="dream-info-list">
                        <li><strong>Buku Mimpi:</strong> ${data.content}</li>
                        <li><strong>Angka Pelarian:</strong> ${data.pelarian}</li>
                        <li><strong>Erek Erek:</strong> ${data.erek}</li>
                        <li><strong>Kode Alam:</strong> ${data.kode}</li>
                        <li><strong>Gaya Baru:</strong> ${data.gaya}</li>
                    </ul>
                </div>
            `;
        } else {
            detailsHtml = `<div class="dream-details"><p>-</p></div>`; // Placeholder
        }

        item.innerHTML = `
            <div class="dream-card-header">
                <div class="dream-number">${numStr}</div>
                <img src="${imgPath}" class="dream-img" loading="lazy" alt="Buku Mimpi ${numStr}">
            </div>
            ${detailsHtml}
        `;

        grid.appendChild(item);
    }

    // Updated Search Functionality
    const searchInput = document.getElementById('dreamSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            const items = document.querySelectorAll('.dream-item');

            items.forEach(item => {
                const num = item.getAttribute('data-num');
                const textContent = item.textContent.toLowerCase();

                if (textContent.includes(term)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }

    dreamBookInitialized = true;
    console.log('Dream Book Initialized with Rich Data');
}
