/**
 * Infinity Hub Cloud v4.7 - Premium Layout & Date Formatting
 */

let WEB_APP_URL = localStorage.getItem('cfg_web_app_url') || 'https://script.google.com/macros/s/AKfycbxGIwzeaaVvFD1wft3Nyt2ceFaEeCSr49upvWRnisApgOdfzGbhy77RGyRAYt7wJVL9/exec';

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
    }
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
    const filtered = currentCategory === 'all' ? allNotes : allNotes.filter(n => n.category === currentCategory);

    notesGrid.innerHTML = '';
    if (filtered.length === 0) {
        notesGrid.innerHTML = '<div class="loading-state"><i class="fas fa-folder-open"></i><p>No notes found in this category.</p></div>';
        return;
    }

    [...filtered].reverse().forEach((note, index) => {
        const cardWrapper = document.createElement('div');
        cardWrapper.className = 'card entry-anim';
        cardWrapper.style.animationDelay = `${index * 0.05}s`;
        cardWrapper.ondblclick = (e) => toggleExpand(cardWrapper, e);
        cardWrapper.innerHTML = `
            <span class="note-category-badge">${note.category || 'General'}</span>
            <div class="card2">
                <div class="card-inner-top">
                    <div class="heading">${note.title || 'Untitled'}</div>
                    <div class="content-text">${note.content || ''}</div>
                </div>
                <div class="meta-text">
                    <span class="note-date"><i class="far fa-calendar-alt"></i> ${formatDate(note.date)}</span>
                    <div class="note-actions">
                        <button class="btn-icon" onclick="copyNote('${note.id}')" title="Copy"><i class="fas fa-copy"></i></button>
                        <button class="btn-icon" onclick="editNote('${note.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon delete" onclick="deleteNote('${note.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `;
        notesGrid.appendChild(cardWrapper);
    });
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
    const label = btn.querySelector('strong');
    btn.disabled = true;
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
    } catch (e) { showToast('Server error', 'error'); }

    btn.disabled = false;
    label.textContent = 'SAVE NOTE';
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
                const isZip = f.name.toLowerCase().endsWith('.zip');
                const icon = isZip ? 'fa-file-zipper' : 'fa-file-code';
                const card = document.createElement('div');
                card.className = 'card entry-anim';
                card.style.animationDelay = `${idx * 0.05}s`;
                card.ondblclick = (e) => toggleExpand(card, e);
                card.innerHTML = `
                    <div class="card2">
                        <div class="card-inner-top">
                            <div class="ext-icon-box">
                                <i class="fas ${icon}"></i>
                            </div>
                            <div class="heading">${f.name}</div>
                            <div class="content-text">${f.description || 'Google Drive File'}</div>
                        </div>
                        <div class="meta-text">
                            <span class="note-date"><i class="fas fa-hdd"></i> ${(f.size / 1024 / 1024).toFixed(2)} MB</span>
                            <a href="https://drive.google.com/uc?export=download&id=${f.id}" target="_blank" class="btn-icon" title="Download">
                                <i class="fas fa-download"></i>
                            </a>
                        </div>
                    </div>
                `;
                extensionGrid.appendChild(card);
            });
        }
    } catch (e) { console.error(e); }
}

document.getElementById('extension-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('upload-btn');
    const label = btn.querySelector('strong');
    const file = document.getElementById('ext-file').files[0];
    const name = document.getElementById('ext-name').value;

    if (!file) return showToast('Please select a file', 'error');
    btn.disabled = true;
    label.textContent = 'UPLOADING...';

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        try {
            const resp = await fetch(WEB_APP_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'uploadExtension',
                    fileName: name || file.name,
                    base64: base64,
                    description: 'Direct Hub Upload'
                })
            });
            const res = await resp.json();
            if (res.success) {
                showToast('Upload successful!', 'success');
                document.getElementById('extension-modal').classList.remove('active');
                fetchExtensions();
            } else { showToast(res.error, 'error'); }
        } catch (err) { showToast('Upload failed', 'error'); }
        btn.disabled = false;
        label.textContent = 'START UPLOAD';
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
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(target).classList.add('active');
            document.getElementById('page-title').textContent = link.querySelector('span').textContent;
            document.getElementById('add-extension-btn').style.display = target === 'extensions-section' ? 'flex' : 'none';
            document.getElementById('notes-actions').style.display = target === 'notes-section' ? 'flex' : 'none';
        });
    });

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
        const nominal = allCurrencyNumbers ? allCurrencyNumbers[allCurrencyNumbers.length - 1] : '0';

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

    // Add empty rows to match the image style (at least 12 rows total)
    const emptyCount = Math.max(0, 12 - chunks.length);
    for (let i = 0; i < emptyCount; i++) {
        const row = document.createElement('div');
        row.className = 'split-row empty';
        row.innerHTML = `
            <div class="copy-side left">COPY INI<br> >> </div>
            <div class="split-value">0</div>
            <div class="copy-side right"> << <br>COPY INI</div>
        `;
        container.appendChild(row);
    }

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

// --- PG SOFT SPIN CALCULATOR LOGIC ---
window.processPGCalculator = () => {
    const input = document.getElementById('pg-calc-input');
    const display = document.getElementById('pg-total-win');
    if (!input || !display) return;

    const rawData = input.value;
    if (!rawData.trim()) {
        display.innerText = 'IDR 0';
        return;
    }

    const lines = rawData.split('\n');
    let total = 0;
    let skipNextValue = false;

    lines.forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;

        // Detect Normal Spin to skip its value
        if (/Normal Spin/i.test(trimmedLine)) {
            skipNextValue = true;
            return;
        }

        const match = trimmedLine.match(/IDR\s*([\d,.]+)/i);
        if (match) {
            if (skipNextValue) {
                skipNextValue = false;
                return;
            }

            let numStr = match[1];
            // Normalize Indonesian format: "." (thousands) -> "" and "," (decimal) -> "."
            let cleanNum = numStr.replace(/\./g, '').replace(/,/g, '.');
            let val = parseFloat(cleanNum);

            if (!isNaN(val)) {
                total += val;
            }
        }
    });

    // Multiply by 1000 and format for IDR with commas (en-US locale)
    const finalTotal = total * 1000;
    const formatted = finalTotal.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });

    display.innerText = 'IDR ' + formatted;
};

window.clearPGCalculator = () => {
    const input = document.getElementById('pg-calc-input');
    const display = document.getElementById('pg-total-win');
    if (input) input.value = '';
    if (display) display.innerText = 'IDR 0';
    showToast('PG Calculator cleared', 'info');
};

// Initialize once
initParlay();
