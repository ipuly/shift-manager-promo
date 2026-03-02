// ==========================================================
// 1. KONFIGURASI DATABASE ONLINE
// ==========================================================
// Masukkan Bin ID dari JSONBin.io (Contoh: 65a9f2...)
const BIN_ID = "69634ea7ae596e708fd41782"; 

// Masukkan X-Master-Key dari JSONBin.io (Contoh: $2b$10$AbCd...)
const API_KEY = "$2a$10$RXGdAiIa7/XsWtRPu8/J8uk2UNU6mS.cSVVVaHaKmx2KFPF.JucsO"; 

const ADMIN_PASSWORD = "ipulyganteng"; 
const AUTH_KEY = "shift_manager_auth_token"; 

// ==========================================================
// 2. STATE APLIKASI
// ==========================================================
let isAdmin = false; 
let accessLogs = []; // Variabel penampung history login
let masterData = [];

// Data Jadwal
let shiftDataCurrent = []; // Minggu Ini
let shiftDataNext = [];    // Minggu Depan
let bulletinMessage = "No new announcements."; // Bulletin Board
let lastUpdateTime = "-";

let currentViewMode = 'current'; // 'current' atau 'next'

let selectedFilterLetter = 'ALL';

let selectedTagFilter = 'ALL'; 

let headerGreetingMode = true;

let currentTheme = "default"; 

// Kode Shift & Warna (Sesuai CSS Variables)
const shiftTypes = {
    0: { code: "OFF", class: "bg-o" }, 
    1: { code: "P", class: "bg-p" },   
    2: { code: "S", class: "bg-s" },   
    3: { code: "M", class: "bg-m" },   
    4: { code: "VL", class: "bg-vl" }, 
    5: { code: "LOA", class: "bg-loa" },
    6: { code: "BL", class: "bg-bl" }  
};

// ==========================================================
// 3. SYSTEM AUTH & UI ADMIN
// ==========================================================

function checkAuth() {
    if(localStorage.getItem(AUTH_KEY) === "true") {
        isAdmin = true;
        updateUIForAdmin();
    }
}

function updateUIForAdmin() {
    const authText = document.getElementById('authText');
    const authIcon = document.getElementById('authIcon');
    const session = localStorage.getItem('SHIFT_APP_SESSION'); // Cek status login
    
    // Update Teks Login/Logout
    if(authText && authIcon) {
        if(session) {
            // JIKA SUDAH LOGIN (Siapapun): Tampilkan Logout
            authText.innerText = "Logout";
            // Ganti ikon gembok jadi ikon pintu keluar
            authIcon.className = "ph ph-sign-out"; 
            
            // Tambahkan warna merah biar jelas ini tombol keluar (Opsional)
            authIcon.style.color = "#ef4444"; 
        } else {
            // JIKA BELUM LOGIN
            authText.innerText = "Login";
            authIcon.className = "ph ph-sign-in";
            authIcon.style.color = ""; // Reset warna
        }
    }

    // DAFTAR MENU KHUSUS ADMIN
    const elementsToToggle = [
        'btnRollOver',      
        'nav-import',       
        'nav-swap',         
        'btnAddAgent',      
        'btnResetShifts',   
        'btnEditBulletin',
        'navLogHistory',
        'adminThemeSection'
    ];
    
    // Toggle My Account (Hanya untuk Agent)
    const btnAccount = document.getElementById('navMyAccount');
    if (btnAccount) {
        if (isAdmin) {
             btnAccount.style.setProperty('display', 'none', 'important');
        } else {
             btnAccount.style.removeProperty('display');
             btnAccount.style.display = 'flex'; 
        }
    }

    // Toggle Menu Admin
    elementsToToggle.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            if (isAdmin) {
                el.style.removeProperty('display');
                if(getComputedStyle(el).display === 'none') el.style.display = 'flex';
            } else {
                el.style.setProperty('display', 'none', 'important');
            }
        }
    });
    isEditMode = false; 
    updateEditModeUI();

    // 2. Kontrol tombol Lock (Hanya muncul jika user adalah Admin)
    const btnLock = document.getElementById('btnEditToggle');
    if(btnLock) {
        // Jika Admin: Tampilkan (flex), Jika bukan: Sembunyikan (none)
        btnLock.style.display = isAdmin ? 'flex' : 'none';
    }
}

// --- LOGIKA HAMBURGER MENU ---
function toggleMenu() {
    const menu = document.getElementById('mainMenu');
    if(menu) menu.classList.toggle('show');
}

// Tutup menu jika klik di luar
window.onclick = function(event) {
    if (!event.target.closest('.hamburger-btn') && !event.target.closest('.dropdown-menu')) {
        const menu = document.getElementById('mainMenu');
        if (menu && menu.classList.contains('show')) {
            menu.classList.remove('show');
        }
    }
}

function handleAuthAction() {
    toggleMenu(); // Tutup menu hamburger
    
    const session = localStorage.getItem('SHIFT_APP_SESSION');
    
    if (session) {
        // [GANTI] Pakai Modal Kustom
        askConfirmation('logout'); 
    } else {
        location.reload();
    }
}



function showLoginModal() {
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('adminPassInput').focus();
}

function doLogin() {
    const pass = document.getElementById('adminPassInput').value;
    if (pass === ADMIN_PASSWORD) {
        localStorage.setItem(AUTH_KEY, "true");
        isAdmin = true;
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('adminPassInput').value = "";
        updateUIForAdmin();
        refreshAllViews();
        showToast("Welcome back, Admin!", "success");
    } else {
        alert("Wrong Password!");
    }
}

// --- SAFETY LOCK LOGIC ---
let isEditMode = false; // Default: Locked

function toggleEditMode() {
    // Cek izin admin dulu
    if (!checkPermission()) return;

    isEditMode = !isEditMode;
    updateEditModeUI();
}

function updateEditModeUI() {
    const btn = document.getElementById('btnEditToggle');
    if (!btn) return;

    if (isEditMode) {
        // --- STATE: UNLOCKED (Bisa Edit) ---
        btn.className = "btn btn-icon-text btn-unlocked";
        // Icon pensil menandakan sedang mode tulis
        btn.innerHTML = `<i class="ph ph-pencil-simple-line"></i> <span>Editing Enabled</span>`;
        
        document.body.classList.remove('edit-locked');
        
        // Notif Modern: Tipe "error" (Merah) dipakai untuk 'Warning'
        showToast("Edit Mode Active. Tap carefully.", "error"); 
    } else {
        // --- STATE: LOCKED (Hanya Baca) ---
        btn.className = "btn btn-icon-text btn-locked";
        // Icon Shield menandakan aman
        btn.innerHTML = `<i class="ph ph-shield-check"></i> <span>Read-Only View</span>`;
        
        document.body.classList.add('edit-locked');
        
        // Notif Modern: Tipe "success" (Hijau)
        showToast("Schedule Locked. Safe to scroll.", "success");
    }
}


// =========================================
// FITUR LIHAT PASSWORD (MATA)
// =========================================

function togglePasswordVisibility() {
    const passwordInput = document.getElementById('adminPassInput');
    const eyeIcon = document.getElementById('eyeIcon');
    
    // Cek tipe input saat ini
    if (passwordInput.type === 'password') {
        // UBAH JADI TEXT (TERLIHAT)
        passwordInput.type = 'text';
        
        // Ganti ikon jadi mata dicoret (slash)
        eyeIcon.classList.remove('ph-eye');
        eyeIcon.classList.add('ph-eye-slash');
    } else {
        // KEMBALIKAN JADI PASSWORD (SENSOR)
        passwordInput.type = 'password';
        
        // Ganti ikon jadi mata biasa
        eyeIcon.classList.remove('ph-eye-slash');
        eyeIcon.classList.add('ph-eye');
    }
}

// Ganti fungsi doLogout yang lama (jika ada) dengan ini:
function doLogout() {
    // Hapus sesi dari memori
    localStorage.removeItem('SHIFT_APP_SESSION');
    localStorage.removeItem('AUTH_KEY'); // Hapus key lama juga jika ada
    
    isAdmin = false;
    
    // Reload halaman agar kembali ke Lock Screen
    location.reload(); 
}


// =========================================
// UPDATE: PERMISSION CHECK DENGAN MODAL
// =========================================

function checkPermission() {
    if(!isAdmin) {
        // HAPUS atau Comment baris alert lama:
        // alert("🔒 Access Denied! Please Login as Admin.");
        
        // GANTI dengan pemanggil modal baru:
        showAccessDeniedModal();
        return false;
    }
    return true;
}

// --- FUNGSI HELPER MODAL ACCESS DENIED ---

function showAccessDeniedModal() {
    const modal = document.getElementById('accessDeniedModal');
    if(modal) {
        modal.style.display = 'flex';
        // Efek getar HP (Haptic)
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]); 
    }
}

function closeAccessDeniedModal() {
    document.getElementById('accessDeniedModal').style.display = 'none';
}

function openLoginFromWarning() {
    closeAccessDeniedModal(); // Tutup peringatan
    showLoginModal();         // Buka form login
}

// --- FITUR WOW: HOLIDAY CELEBRATION ---
function triggerCelebration() {
    // Cek apakah sudah pernah merayakan di sesi ini? (Agar tidak berulang-ulang saat refresh header)
    if (sessionStorage.getItem('has_celebrated')) return;

    // Setup Konfeti
    var duration = 3 * 1000; // Durasi 3 detik
    var animationEnd = Date.now() + duration;
    var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }

    // Jalankan interval letupan
    var interval = setInterval(function() {
      var timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      var particleCount = 50 * (timeLeft / duration);
      
      // Tembak dari Kiri & Kanan
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);

    // Tandai bahwa perayaan sudah dilakukan
    sessionStorage.setItem('has_celebrated', 'true');
    
    // Opsional: Getar HP
    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
}


// ==========================================================
// 4. DATA HANDLING (LOAD & SAVE)
// ==========================================================
function autoLoginCheck() {
    const session = localStorage.getItem('SHIFT_APP_SESSION');
    const expiry = localStorage.getItem('SHIFT_REMEMBER_EXPIRY');
    const now = new Date().getTime();

    // Jika ada session dan belum expired (atau memang Admin)
    if (session && expiry && now < parseInt(expiry)) {
        console.log("Session valid, auto unlocking...");
        finishLoginProcess();
        return true;
    }
    return false;
}

async function initData() {
    checkAuth(); 
    initTheme(); 

    const loadingLayer = document.getElementById("loadingLayer");
    
    try {
        const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
            method: 'GET',
            headers: { 'X-Master-Key': API_KEY }
        });
        
        if(!res.ok) throw new Error("Connection failed");
        
        const json = await res.json();
        const data = json.record;

        // Inisialisasi Data Global
        masterData = data.master || [];
        shiftDataCurrent = data.shifts || []; 
        shiftDataNext = data.shiftsNext || Array(masterData.length).fill().map(() => Array(7).fill(0));
        bulletinMessage = data.bulletin || "No new announcements.";
        accessLogs = data.accessLogs || []; 
        lastUpdateTime = data.lastUpdate || "-";
        currentTheme = data.currentTheme || "default"; 
        
        updateTimeBadge();
        applyTheme(currentTheme);

        // Migrasi & Validasi Data
        let needMigration = false;
        if (masterData.length > 0 && !masterData[0].password) {
            masterData.forEach(agent => { agent.password = "123456"; });
            needMigration = true;
        }
        if(shiftDataNext.length < masterData.length) {
             const diff = masterData.length - shiftDataNext.length;
             for(let i=0; i<diff; i++) shiftDataNext.push([0,0,0,0,0,0,0]);
        }

        renderBulletin(); 
        if (needMigration) await saveAllSilent();
        if(loadingLayer) loadingLayer.style.display = 'none';
        
        // Siapkan Komponen UI
        prepareLockScreen(); 
        setTodayAsDefault(); 

        // --- LOGIKA AUTO LOGIN (REMEMBER ME) ---
        const isAutoLoggedIn = autoLoginCheck();

        // Logika Preloader & Modal Login
        setTimeout(() => {
            const loader = document.getElementById('preloader');
            if(loader) {
                loader.style.opacity = '0';
                loader.style.visibility = 'hidden';
                
                setTimeout(() => { 
                    loader.style.display = 'none'; 
                    // Tampilkan modal login HANYA JIKA tidak berhasil auto-login
                    if (!isAutoLoggedIn) {
                        const authModal = document.getElementById('initialAuthModal');
                        if(authModal) {
                            authModal.style.display = 'flex';
                            authModal.style.opacity = '1';
                        }
                    } else {
                        // Jika auto-login berhasil, pastikan UI dashboard siap
                        updateHeaderGreeting(); 
                        forceOpenScheduleTab();
                    }
                }, 500);
            }
        }, 1500);

    } catch (error) {
        console.error("Initialization Error:", error);
        // Sembunyikan loader jika error agar tidak stuck
        const loader = document.getElementById('preloader');
        if(loader) loader.style.display = 'none';
        alert("Failed to sync with database. Please check your connection.");
    }

    // Timer Sapaan (Hanya jalan jika sudah login)
    setInterval(() => {
        const myId = localStorage.getItem('my_profile_id');
        if (myId !== null && masterData[myId]) {
            headerGreetingMode = !headerGreetingMode;
            updateHeaderGreeting();
        }
    }, 5000);
}


// --- FITUR AUTO SELECT HARI INI ---
// --- LOGIKA DAY CHIPS ---
function selectDay(dayIdx, btnElement) {
    // 1. Update nilai hidden input (agar fungsi lain tetap jalan)
    document.getElementById("daySelector").value = dayIdx;

    // 2. Update Visual Tombol (Pindahkan kelas .active)
    document.querySelectorAll('.day-chip').forEach(btn => btn.classList.remove('active'));
    if(btnElement) {
        btnElement.classList.add('active');
        
        // Auto scroll agar tombol yang dipilih terlihat di tengah
        btnElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    // 3. Render Data
    renderGrouping();
}

// UPDATE FUNGSI AUTO-SELECT (Agar kompatibel dengan Chips)
function setTodayAsDefault() {
    const today = new Date();
    const jsDay = today.getDay(); 
    let appDayIdx = jsDay - 1;
    if (appDayIdx === -1) appDayIdx = 6; 

    // Cari tombol chip yang sesuai hari ini dan klik secara programatis
    const chips = document.querySelectorAll('.day-chip');
    if(chips[appDayIdx]) {
        selectDay(appDayIdx, chips[appDayIdx]);
    }
}

async function saveAll() {
    // 1. Update Waktu Terakhir Simpan
    const now = new Date();
    lastUpdateTime = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + " " + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    
    // Update Badge Jam di Header
    updateTimeBadge(); 

    // 2. Siapkan Data yang Mau Disimpan
    const payload = { 
        master: masterData, 
        shifts: shiftDataCurrent, 
        shiftsNext: shiftDataNext,
        bulletin: bulletinMessage,
        accessLogs: accessLogs, 
        lastUpdate: lastUpdateTime,
        currentTheme: currentTheme
    }

    // 3. Tampilkan Toast "Sedang Menyimpan..."
    showToast("Saving changes...", "process");

    try {
        // 4. Kirim ke JSONBin (PUT Request)
        const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': API_KEY
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            console.log("Save Success");
            showToast("Data Saved Successfully!", "success");
        } else {
            throw new Error("Server rejected save");
        }
    } catch (e) { 
        console.error("Save failed", e); 
        showToast("Failed to Save Data! Check Internet.", "error");
    }
}


// Tambahkan fungsi save silent (tanpa notifikasi toast)
async function saveAllSilent() {
    // [PENTING] Baris "if(!isAdmin) return;" SUDAH DIHAPUS DISINI.
    // Ini wajib agar Agent bisa menyimpan password mereka sendiri ke database.
    
    const now = new Date();
    // Format waktu simpel untuk log
    const timeString = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + " • " + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const payload = { 
        master: masterData, 
        shifts: shiftDataCurrent, 
        shiftsNext: shiftDataNext,
        bulletin: bulletinMessage,
        accessLogs: accessLogs, 
        lastUpdate: lastUpdateTime 
    }

    try {
        await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': API_KEY
            },
            body: JSON.stringify(payload)
        });
        console.log("Data saved silently (Log/Password).");
    } catch (e) { 
        console.error("Silent save failed", e); 
    }
}


// ==========================================================
// 5. FITUR: BULLETIN BOARD & DUAL WEEK
// ==========================================================

function renderBulletin() {
    const el = document.getElementById('bulletinText');
    if(el) {
        el.innerText = bulletinMessage || "No new announcements."  
    }
}

// =========================================
// LOGIKA MODAL BULLETIN (PENGUMUMAN)
// =========================================

function openBulletinModal() {
    const modal = document.getElementById('editBulletinModal');
    const textarea = document.getElementById('bulletinInputArea');
    
    // Masukkan teks pengumuman yang sekarang ke dalam textarea
    // Kita ambil dari variabel global bulletinMessage (dari script sebelumnya)
    textarea.value = bulletinMessage || ""; 
    
    modal.style.display = 'flex';
    textarea.focus();
}

function closeBulletinModal() {
    document.getElementById('editBulletinModal').style.display = 'none';
}

function saveBulletinFromModal() {
    const newVal = document.getElementById('bulletinInputArea').value;
    
    if(!newVal.trim()) {
        alert("Announcement cannot be empty!");
        return;
    }

    // Update variable global
    bulletinMessage = newVal;
    
    // Update tampilan di layar
    renderBulletin(); 
    
    // Simpan ke database
    saveAll(); 
    
    // Tutup modal
    closeBulletinModal();
    showToast("Announcement Updated!", "success");
}

function getActiveShiftData() {
    return (currentViewMode === 'current') ? shiftDataCurrent : shiftDataNext;
}

function setActiveShiftData(newData) {
    if(currentViewMode === 'current') {
        shiftDataCurrent = newData;
    } else {
        shiftDataNext = newData;
    }
}

function switchWeekMode() {
    const selector = document.getElementById('weekSelector');
    currentViewMode = selector.value;
    refreshAllViews();
}

function promoteNextToCurrent() {
    if(!checkPermission()) return;
    
    // [GANTI] Pakai Modal Kustom
    askConfirmation('rollover');
}


// ==========================================================
// 6. UI UTAMA (DASHBOARD, TABLE, DLL)
// ==========================================================

function refreshAllViews() {
    renderTables(); 
    renderGrouping(); 
    populateSwapDropdowns(); 
    renderAgentList();
    
    updateHeaderGreeting();
    
    /* renderDailyNarrative(); */
}

function switchTab(tabName, btnElement) {
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    btnElement.classList.add('active');
}


function applyTheme(themeName) {
    // Hapus semua kelas tema lama
    document.body.classList.remove('theme-emerald', 'theme-purple', 'theme-sunset');
    
    // Pasang tema baru jika bukan default
    if(themeName !== "default") {
        document.body.classList.add('theme-' + themeName);
    }
    currentTheme = themeName;
}

function adminChangeTheme(themeName) {
    if(!isAdmin) return; // Hanya Admin yang bisa set
    applyTheme(themeName);
    saveAll(); // Simpan pilihan ke database agar semua user berubah
    showToast("Theme updated for all users!", "success");
}


// ==========================================================
// FUNGSI RENDER TABLES (MODERN LAYOUT)
// ==========================================================

function renderTables() {
    const container = document.getElementById("mainContainer");
    container.innerHTML = ""; 
    
    // 1. Ambil daftar Agent yang memiliki Role 'TL'
    const allTLs = masterData.filter(agent => agent.role === "TL");
    
    // 2. Buat daftar nama tim secara dinamis
    let supervisors = allTLs.map(tl => tl.name);
    
    // Tambahkan Support manual jika diperlukan
    if (!supervisors.includes("Support")) supervisors.push("Support");

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const jsDay = new Date().getDay(); 
    let todayColIdx = jsDay - 1; 
    if (todayColIdx === -1) todayColIdx = 6; 

    const activeShifts = getActiveShiftData();

    supervisors.forEach(spvName => {
        // PERBAIKAN: Filter anggota tim dengan pengecekan yang lebih fleksibel
        // Mencocokkan jika kolom 'spv' agen mengandung nama depan TL atau sama persis
        const teamMembers = masterData.filter(agent => {
            if (!agent.spv) return false;
            const spvLower = agent.spv.toLowerCase();
            const targetLower = spvName.toLowerCase();
            const firstName = spvName.split(' ')[0].toLowerCase();
            
            return spvLower === targetLower || spvLower === firstName;
        });
        
        // Jangan render jika tim kosong
        if (teamMembers.length === 0) return;

        const section = document.createElement("div");
        section.className = "team-section";
        section.dataset.team = spvName; 
        section.innerHTML = `<div class="team-header">TEAM ${spvName.toUpperCase()}</div>`;
        
        let tableHtml = `<table><thead><tr><th>Name</th>`;
        days.forEach((d, i) => {
            const isToday = (i === todayColIdx) ? 'class="today-col"' : '';
            tableHtml += `<th ${isToday}>${d}</th>`;
        });
        tableHtml += `</tr></thead><tbody>`;

        teamMembers.forEach(agent => {
            const globalIndex = masterData.findIndex(m => m.name === agent.name);
            const myId = localStorage.getItem('my_profile_id');
            const isMe = (myId == globalIndex) ? "class='my-row'" : ""; 

            tableHtml += `<tr ${isMe} id="row-${globalIndex}" onclick="toggleRowHighlight(${globalIndex})">
                <td>${agent.name}</td>`;
            
            for(let d=0; d<7; d++) {
                const val = activeShifts[globalIndex][d];
                const type = shiftTypes[val] || shiftTypes[0]; 
                const isTodayCell = (d === todayColIdx) ? 'today-col' : '';

                tableHtml += `<td class="${isTodayCell}">
                    <button class="cell-btn ${type.class}" 
                        onmousedown="startPress(${globalIndex}, ${d})" 
                        onmouseup="handleRelease(${globalIndex}, ${d})" 
                        ontouchstart="startPress(${globalIndex}, ${d})" 
                        ontouchend="handleRelease(${globalIndex}, ${d})"
                    >${type.code}</button>
                </td>`;
            }
            tableHtml += `</tr>`;
        });
        tableHtml += `</tbody></table>`;
        section.appendChild(document.createElement("div")).innerHTML = tableHtml;
        container.appendChild(section);
    });
    
    // Panggil fungsi untuk update dropdown filter agar sinkron
    updateTeamFilterDropdown(supervisors);
    filterTables(); 
    renderInteractiveLegend();
} 

function updateTeamFilterDropdown(activeSupervisors) {
    const filterSelect = document.getElementById("teamFilter");
    if (!filterSelect) return;

    // Simpan nilai yang sedang dipilih user sekarang
    const currentSelection = filterSelect.value;

    // Reset isi dropdown
    filterSelect.innerHTML = '<option value="ALL">All Teams</option>';

    activeSupervisors.forEach(spv => {
        const opt = document.createElement("option");
        opt.value = spv;
        opt.text = `Team ${spv}`;
        filterSelect.appendChild(opt);
    });

    // Kembalikan pilihan user jika masih ada di daftar baru
    filterSelect.value = currentSelection;
    if (!filterSelect.value) filterSelect.value = "ALL";
}


function filterTables() {
    const selected = document.getElementById("teamFilter").value;
    document.querySelectorAll(".team-section").forEach(sec => {
        sec.style.display = (selected === "ALL" || sec.dataset.team === selected) ? "block" : "none";
    });
}

function cycleShift(idx, dayIdx) {
    // Jika bukan Admin, keluar secara senyap tanpa notifikasi
    if(!isAdmin) return; 
    
    // Jika Admin tapi mode edit belum diaktifkan, baru munculkan peringatan
    if (!isEditMode) {
        if (navigator.vibrate) navigator.vibrate(50);
        showToast("🔒 View Only. Tap button to edit.", "error");
        return; 
    }
    
    let targetArray = getActiveShiftData();
    let val = targetArray[idx][dayIdx];
    val++; 
    if (val > 6) val = 0; 
    targetArray[idx][dayIdx] = val;
    setActiveShiftData(targetArray);
    
    // Optimasi render
    const cell = document.querySelector(`#row-${idx} button[onmouseup*="${dayIdx}"]`) 
              || document.querySelector(`#row-${idx} button[onclick*="${dayIdx}"]`); // Fallback
    
    // Optimasi: Hanya render ulang tabel, tidak seluruh view
    refreshAllViews();
    saveAll();     
}

function searchNames() {
    const filter = document.getElementById("searchInput").value.toUpperCase();
    document.querySelectorAll("tbody tr").forEach(row => {
        const txt = row.cells[0].innerText;
        row.style.display = txt.toUpperCase().indexOf(filter) > -1 ? "" : "none";
    });
}

// ==========================================================
// RENDER DASHBOARD (LIST SUMMARY)
// ==========================================================

function renderGrouping() {
    const dayIdx = document.getElementById("daySelector").value;
    
    let lists = { P: [], S: [], M: [], O: [], VL: [], LOA: [], TL: [], SME: [] };
    let agentCounts = { P: 0, S: 0, M: 0 }; 
    
    const activeShifts = getActiveShiftData();
    const myId = localStorage.getItem('my_profile_id'); 

    masterData.forEach((agent, idx) => {
        const val = activeShifts[idx][dayIdx];
        const shiftObj = shiftTypes[val] || shiftTypes[0]; 
        const isMe = (myId == idx);
        const isWorking = (val !== 0 && val !== 4 && val !== 5 && val !== 6); 
        const isSupport = (agent.role === "TL" || agent.role === "SME");

        // --- 1. MODERN SEPARATOR STYLE ---
        // Menggunakan RGBA agar transparan & terlihat modern di Dark/Light mode
        // Padding sedikit diperbesar (8px) agar tidak terlalu rapat
        let rowStyle = "border-bottom: 1px dashed rgba(150, 150, 150, 0.2); padding: 8px 0;"; 
        
        // --- 2. SETUP WARNA TEXT (FIX NIGHT MODE) ---
        // Default: Mengikuti Tema (var(--text-main))
        // Jika Active Profile (isMe): PAKSA jadi HITAM (#1e293b) karena backgroundnya kuning terang
        let textColor = isMe ? "#1e293b" : "var(--text-main)";

        let nameStyle = `font-weight:600; color:${textColor}; font-size:11px; letter-spacing:0.2px;`;
        let badgeHtml = "";
        
        // Style Khusus TL
        if (agent.role === "TL") {
            // Jika isMe, tetap hitam. Jika bukan, jadi Orange.
            const tlColor = isMe ? "#c2410c" : "#e67e22"; 
            nameStyle = `font-weight:700; color:${tlColor}; font-size:11px;`; 
            badgeHtml = `<span style="font-size:9px; border:1px solid ${tlColor}; color:${tlColor}; padding:0px 3px; border-radius:3px; margin-left:5px; font-weight:600;">TL</span>`;
        } 
        // Style Khusus SME
        else if (agent.role === "SME") {
            const smeColor = isMe ? "#7e22ce" : "#9b59b6";
            nameStyle = `font-weight:700; color:${smeColor}; font-size:11px;`; 
            badgeHtml = `<span style="font-size:9px; border:1px solid ${smeColor}; color:${smeColor}; padding:0px 3px; border-radius:3px; margin-left:5px; font-weight:600;">SME</span>`;
        }

        // --- HTML STRUKTUR ---
        const htmlContent = `
            <div style="${rowStyle} display:flex; justify-content:space-between; align-items:center; width:100%;">
                
                <div style="display:flex; align-items:center; flex-grow:1; overflow:hidden; padding-right:8px;">
                    <span style="${nameStyle} white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${agent.name}${isMe ? ' ⭐' : ''}
                    </span>
                    ${badgeHtml}
                </div>
                
                <span style="font-size:9px; color:#94a3b8; font-weight:bold; background:rgba(150,150,150,0.1); padding:2px 6px; border-radius:4px; flex-shrink:0; border:1px solid rgba(150,150,150,0.2); min-width:20px; text-align:center;">
                    ${shiftObj.code}
                </span>

            </div>
        `;

        const itemData = { html: htmlContent, isMe: isMe };
        
        // --- LOGIC GROUPING ---
        if (agent.role === "TL" && isWorking) lists.TL.push(itemData);
        else if (agent.role === "SME" && isWorking) lists.SME.push(itemData);

        if (val === 1) { // PAGI
            lists.P.push(itemData);       
            if (!isSupport) agentCounts.P++; 
        }
        else if (val === 2) { // SIANG
            lists.S.push(itemData);
            if (!isSupport) agentCounts.S++;
        }
        else if (val === 3) { // MALAM
            lists.M.push(itemData);
            if (!isSupport) agentCounts.M++;
        }
        else if (val === 0) lists.O.push(itemData);  
        else if (val === 5) lists.LOA.push(itemData);
        else if (val === 4 || val === 6) lists.VL.push(itemData); 
    });
    
    // --- RENDER KE DOM ---
    ["P","S","M","O","VL","BL","LOA","TL","SME"].forEach(k => {
        const countSpan = document.getElementById(`c${k}`);
        const ul = document.getElementById(`l${k}`);
        
        if(countSpan && ul) {
            if (k === 'P') countSpan.innerText = agentCounts.P;
            else if (k === 'S') countSpan.innerText = agentCounts.S;
            else if (k === 'M') countSpan.innerText = agentCounts.M;
            else countSpan.innerText = lists[k] ? lists[k].length : 0;

            ul.innerHTML = ""; 

            if(lists[k] && lists[k].length > 0) {
                lists[k].forEach(item => { 
                    const li = document.createElement("li"); 
                    li.style.padding = "0 5px"; 
                    li.style.border = "none";
                    li.style.listStyle = "none";
                    li.innerHTML = item.html; 
                    
                    // Highlight Saya (Background Kuning)
                    if(item.isMe) {
                         li.style.background = "#fffde7"; // Kuning Terang
                         li.style.borderRadius = "6px";
                         // Catatan: Warna teks sudah dipaksa jadi gelap di variabel 'nameStyle' di atas
                    }
                    ul.appendChild(li); 
                });
            } else {
                ul.innerHTML = "<li style='color:#ccc;text-align:center; padding:10px; font-size:10px;'>-</li>";
            }
        }
    });

    /* if(typeof renderDailyNarrative === "function") {
        renderDailyNarrative();
    } */
}

// =========================================
// FEATURE: ZOOM DAILY SUMMARY
// =========================================

let currentZoomLevel = 2; // 0=Tiny, 1=Small, 2=Normal, 3=Large

function changeSummaryZoom(direction) {
    const grid = document.getElementById('summaryGrid');
    const label = document.getElementById('zoomLabel');
    
    if(!grid) return; // Safety check

    if (direction === 'in') {
        // Batas Maksimal tetap Level 3 (125%)
        if (currentZoomLevel < 3) currentZoomLevel++;
    } else {
        // Batas Minimal diturunkan jadi Level 0 (50%)
        if (currentZoomLevel > 0) currentZoomLevel--;
    }

    // 1. Reset Semua Class Zoom
    grid.classList.remove('zoom-tiny', 'zoom-small', 'zoom-large');

    // 2. Terapkan Class Sesuai Level
    if (currentZoomLevel === 0) {
        grid.classList.add('zoom-tiny');
        label.innerText = "50%";
    } else if (currentZoomLevel === 1) {
        grid.classList.add('zoom-small');
        label.innerText = "75%";
    } else if (currentZoomLevel === 2) {
        // Normal (Tidak perlu class tambahan)
        label.innerText = "100%";
    } else if (currentZoomLevel === 3) {
        grid.classList.add('zoom-large');
        label.innerText = "125%";
    }
}

// =========================================
// FITUR BARU: AI MODAL CONTROLLER
// =========================================

let aiTimeout;

function openSummaryModal() {
    const modal = document.getElementById('summaryModal');
    const loadingState = document.getElementById('aiLoadingState');
    const contentState = document.getElementById('aiContentState');
    
    // 1. Reset State (Tampilkan Loading dulu)
    modal.style.display = 'flex';
    loadingState.style.display = 'flex';
    contentState.style.display = 'none';
    contentState.innerHTML = ''; // Bersihkan konten lama

    // 2. Mulai "Gimik" Loading (Fake Delay 1.5 detik)
    clearTimeout(aiTimeout);
    aiTimeout = setTimeout(() => {
        
        // 3. Generate Konten HTML (Panggil fungsi helper di bawah)
        const finalHtml = generateSummaryHtml();
        
        // 4. Tampilkan Konten, Sembunyikan Loading
        loadingState.style.display = 'none';
        contentState.innerHTML = finalHtml;
        contentState.style.display = 'block';
        
    }, 1500); // Waktu delay 1.5 detik (bisa diubah)
}

function closeSummaryModal() {
    document.getElementById('summaryModal').style.display = 'none';
    clearTimeout(aiTimeout); // Stop loading jika ditutup sebelum selesai
}


// =========================================
// HELPER: AI SUMMARY (PROFESSIONAL NO-EMOJI)
// =========================================

function generateSummaryHtml() {
    // 1. Ambil Data Waktu
    const dayIdx = document.getElementById("daySelector").value;
    const mapDayName = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
    const currentDayName = mapDayName[dayIdx];

    // 2. Variabel Hitungan
    let counts = { P: 0, S: 0, M: 0, OFF: 0, VL: 0, BL: 0, LOA: 0 };
    let supports = { P: [], S: [], M: [] };
    let blNames = []; 

    const activeShifts = getActiveShiftData();

    masterData.forEach((agent, idx) => {
        const val = activeShifts[idx][dayIdx];
        const role = agent.role;
        const name = agent.name.split(' ')[0]; // Ambil Nama Depan Saja

        // --- HITUNG DATA ---
        if (val >= 1 && val <= 3) {
            let sCode = (val === 1) ? 'P' : (val === 2 ? 'S' : 'M');
            
            // LOGIKA: Pisahkan Agent & Support
            if (role === "TL" || role === "SME") {
                // HANYA PUSH NAMA (Tanpa embel-embel TL/SME)
                supports[sCode].push(name); 
            } else {
                if (val === 1) counts.P++;
                else if (val === 2) counts.S++;
                else if (val === 3) counts.M++;
            }
        } else {
            if (val === 0) counts.OFF++;
            else if (val === 4) counts.VL++;
            else if (val === 5) counts.LOA++;
            else if (val === 6) { counts.BL++; blNames.push(agent.name); }
        }
    });

    // Helper Render Support (Versi Text Only)
    const renderRow = (label, count, supportArr, colorBorder) => {
        let supportText = `<span style="color:#95a5a6; font-style:italic;">No Support</span>`;
        if (supportArr.length > 0) {
            supportText = `<span style="color:#2c3e50; font-weight:600;">${supportArr.join(", ")}</span>`;
        }
        
        return `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; padding-left:12px; border-left:4px solid ${colorBorder};">
            <div style="display:flex; flex-direction:column;">
                <span style="font-size:11px; font-weight:700; color:#7f8c8d; letter-spacing:1px; text-transform:uppercase;">${label} SHIFT</span>
                <span style="font-size:13px; color:#34495e; margin-top:2px;">Support: ${supportText}</span>
            </div>
            <div style="font-size:16px; font-weight:800; color:#2c3e50;">
                ${count}
            </div>
        </div>`;
    };

    const totalOffline = counts.OFF + counts.VL + counts.LOA + counts.BL;

    // --- SUSUN HTML (LAYOUT BERSIH) ---
    let html = `
        <div style="text-align:left; margin-bottom:20px; border-bottom:1px solid #eee; padding-bottom:10px;">
            <div style="font-size:10px; font-weight:600; color:#bdc3c7; text-transform:uppercase; letter-spacing:1px;">DAILY INSIGHT</div>
            <div style="font-size:18px; font-weight:800; color:#2c3e50; letter-spacing:-0.5px;">${currentDayName}</div>
        </div>
        
        <div style="margin-bottom:25px;">
            ${renderRow("MORNING", counts.P, supports.P, "#2ecc71")}
            ${renderRow("AFTERNOON", counts.S, supports.S, "#3498db")}
            ${renderRow("NIGHT", counts.M, supports.M, "#9b59b6")}
        </div>

        <div style="background:#f8f9fa; border-radius:6px; padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-size:11px; font-weight:700; color:#7f8c8d; text-transform:uppercase;">UNAVAILABLE PERSONNEL</span>
                <span style="font-size:12px; font-weight:800; color:#7f8c8d;">${totalOffline}</span>
            </div>
            
            <div style="font-size:12px; color:#555; line-height:1.6; display:flex; flex-wrap:wrap; gap:12px;">
    `;

    // Offline Details (Simpel & Datar)
    if (counts.OFF > 0) html += `<span><b style="color:#2c3e50;">${counts.OFF}</b> Off Duty</span>`;
    if (counts.VL > 0) html += `<span><b style="color:#2c3e50;">${counts.VL}</b> VL</span>`;
    if (counts.LOA > 0) html += `<span><b style="color:#2c3e50;">${counts.LOA}</b> LOA</span>`;
    
    html += `</div>`; // Tutup flex offline

    // BL (Birthday) - Tampil Beda tapi tetap profesional (Warna Aksen)
    if (counts.BL > 0) {
        const blText = blNames.join(", ");
        html += `
        <div style="margin-top:12px; padding-top:10px; border-top:1px dashed #e0e0e0; color:#e91e63; font-size:12px; font-weight:600;">
            Happy Birthday to ${blText}
        </div>`;
    }

    html += `</div>`; // Tutup container offline

    return html; 
}


// --- SMART PASTE (Google Lens) ---
function processPaste() {
    if(!checkPermission()) return; 

    const rawText = document.getElementById('pasteArea').value;
    if(!rawText.trim()) return alert("Please paste some text first!");

    const lines = rawText.split(/\r?\n/);
    let matchesCount = 0;
    let targetArray = getActiveShiftData();

    masterData.forEach((agent, agentIdx) => {
        const firstName = agent.name.split(' ')[0].toLowerCase();
        for(let line of lines) {
            if(line.length < 5) continue;
            if(line.toLowerCase().includes(firstName)) {
                // Regex Pattern Recognition
                const pattern = /((0[0-9]|1[0-9]|2[0-3])[:\.]\d{2})(?=\s*-\s*\d{2}:\d{2})|OFF|VL|LOA|CUTI|BL|PROMOTED/gi;
                const shifts = line.match(pattern);

                if(shifts && shifts.length > 0) {
                    for(let i=0; i < Math.min(shifts.length, 7); i++) {
                        let s = shifts[i].toUpperCase().replace('.', ':');
                        let code = 0; // Default OFF
                        
                        if(s === "OFF" || s === "PROMOTED") code = 0;
                        else if(s === "VL" || s === "CUTI") code = 4;
                        else if(s === "LOA") code = 5;
                        else if(s === "BL") code = 6;
                        else {
                            const hour = parseInt(s.split(':')[0]);
                            if(hour >= 5 && hour <= 10) code = 1;       
                            else if(hour >= 11 && hour <= 14) code = 2; 
                            else if(hour >= 15 && hour <= 21) code = 3; 
                        }
                        targetArray[agentIdx][i] = code;
                    }
                    matchesCount++;
                    break; 
                }
            }
        }
    });
    setActiveShiftData(targetArray);
    saveAll(); refreshAllViews();
    showToast(`${matchesCount} agents updated!`, "success");
    switchTab('schedule', document.querySelectorAll('.nav-item')[1]); 
}

// --- SWAP & AGENTS ---
function populateSwapDropdowns() {
    const s1 = document.getElementById("swapAgent1");
    const s2 = document.getElementById("swapAgent2");
    // Kosongkan dan tambah placeholder
    s1.innerHTML = '<option value="">Select Agent...</option>'; 
    s2.innerHTML = '<option value="">Select Agent...</option>';
    
    masterData.forEach((agent, idx) => {
        const opt = document.createElement("option");
        opt.value = idx; opt.text = agent.name;
        s1.appendChild(opt.cloneNode(true)); s2.appendChild(opt.cloneNode(true));
    });
}

function updateSwapPreview() {
    const idx1 = document.getElementById("swapAgent1").value;
    const idx2 = document.getElementById("swapAgent2").value;
    
    renderMiniSchedule(idx1, "preview1"); 
    renderMiniSchedule(idx2, "preview2");
}

function renderMiniSchedule(agentIdx, elementId) {
    const container = document.getElementById(elementId);
    container.innerHTML = "";
    
    if(agentIdx === "") return; // Jika belum dipilih

    const days = ["M","T","W","T","F","S","S"];
    const activeShifts = getActiveShiftData();

    // Style inline untuk mini box karena digenerate JS
    container.style.display = "flex";
    container.style.gap = "2px";
    container.style.marginTop = "5px";

    if(activeShifts[agentIdx]) {
        for(let i=0; i<7; i++) {
            const code = activeShifts[agentIdx][i];
            const type = shiftTypes[code] || shiftTypes[0];
            
            const box = document.createElement("div");
            // Gunakan class dari CSS baru
            box.className = `cell-btn ${type.class}`;
            box.style.width = "20px";
            box.style.height = "20px";
            box.style.fontSize = "8px";
            box.style.borderRadius = "4px";
            
            box.innerText = days[i]; // Tampilkan Inisial Hari
            container.appendChild(box);
        }
    }
}

function performSwap() {
    // 1. Cek Izin Admin
    if(!checkPermission()) return; 
    
    const i1 = document.getElementById("swapAgent1").value;
    const i2 = document.getElementById("swapAgent2").value;
    
    // Ambil checkbox hari yang dicentang
    const days = [];
    document.querySelectorAll('.swap-day:checked').forEach(cb => days.push(cb.value));

    // 2. Validasi Input
    if(i1 === "" || i2 === "") {
        return showToast("Please select both Agent A and Agent B!", "error");
    }
    if(i1 === i2) {
        return showToast("Cannot swap shift with the same person!", "error");
    }
    if(days.length === 0) {
        return showToast("Please select at least one day!", "error");
    }
    
    // 3. Panggil Modal Konfirmasi (Kirim data swap sebagai objek)
    askConfirmation('swap', { agent1: i1, agent2: i2, days: days });
}

// --- AGENT MANAGEMENT ---
function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Palet warna modern (Bukan random acak, tapi konsisten per nama)
    const colors = [
        "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", 
        "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6"
    ];
    // Pilih warna berdasarkan hash nama
    const index = Math.abs(hash % colors.length);
    return colors[index];
}

function getInitials(name) {
    if (!name) return "?";
    // Pecah spasi, ambil huruf pertama setiap kata, gabung, potong 3 huruf, uppercase
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .substring(0, 3) 
        .toUpperCase();
}

// FUNGSI RENDER LIST DENGAN FILTER HURUF
function renderAgentList() {
    const list = document.getElementById("agentListContainer");
    const totalBadge = document.getElementById("totalAgentsBadge");
    
    list.innerHTML = "";

    // --- HELPER: Fungsi untuk render item agent ---
    const createAgentItem = (agent, index) => {
        const role = agent.role || "Agent"; 
        let roleBadgeHTML = "";
        
        if(role === "TL") roleBadgeHTML = `<span class="mini-badge" style="background:rgba(249, 115, 22, 0.1); color:#f97316; border:1px solid rgba(249, 115, 22, 0.3);">TL</span>`;
        if(role === "SME") roleBadgeHTML = `<span class="mini-badge" style="background:rgba(168, 85, 247, 0.1); color:#a855f7; border:1px solid rgba(168, 85, 247, 0.3);">SME</span>`;

        const initials = getInitials(agent.name);
        const avatarColor = stringToColor(agent.name);

        let actionButtons = "";
        if (isAdmin) {
            actionButtons = `<div style="display:flex; gap:8px;">
                <button class="icon-btn-sm" style="color:#f59e0b" onclick="openModal('edit',${index})"><i class="ph ph-pencil-simple"></i></button>
                <button class="icon-btn-sm" style="color:#ef4444" onclick="deleteAgent(${index})"><i class="ph ph-trash"></i></button>
            </div>`;
        }

        return `
        <li class="agent-item">
            <div class="agent-avatar" style="background-color: ${avatarColor};">
                ${initials}
            </div>
            <div class="agent-info-wrapper">
                <span class="agent-name-text">
                    ${agent.name} ${roleBadgeHTML}
                </span>
                <span class="agent-role-text">
                    ${agent.spv} <span style="margin:0 4px">•</span> ${role}
                </span>
            </div>
            ${actionButtons}
        </li>`;
    };

    // --- STEP 1: SIAPKAN DATA AWAL ---
    // Kita simpan index asli agar fungsi Edit/Delete tetap jalan
    let baseData = masterData.map((agent, index) => ({ ...agent, originalIndex: index }));
    
    // Filter Huruf (A-Z) tetap jalan untuk semua mode
    if (selectedFilterLetter !== 'ALL') {
        baseData = baseData.filter(agent => 
            agent.name.toUpperCase().startsWith(selectedFilterLetter)
        );
    }
    
    // Update Badge Total
    if(totalBadge) totalBadge.innerText = `Total: ${baseData.length}`;

    // --- STEP 2: LOGIKA RENDERING KHUSUS "SUPPORT" ---
    if (selectedTagFilter === 'Support') {
        
        // A. Ambil Data TL & SME
        const tlList = baseData.filter(a => a.role === 'TL');
        const smeList = baseData.filter(a => a.role === 'SME');
        
        // Sorting Nama
        tlList.sort((a, b) => a.name.localeCompare(b.name));
        smeList.sort((a, b) => a.name.localeCompare(b.name));

        // B. Render Judul "Team Leader"
        if(tlList.length > 0) {
            list.innerHTML += `
            <div style="padding: 15px 15px 5px 15px; background:var(--bg-body); border-bottom:1px solid var(--border);">
                <span style="font-size:11px; font-weight:700; color:#f97316; text-transform:uppercase; letter-spacing:1px;">
                    <i class="ph ph-star-four" style="margin-right:4px;"></i> Team Leaders
                </span>
            </div>`;
            tlList.forEach(agent => {
                list.innerHTML += createAgentItem(agent, agent.originalIndex);
            });
        }

        // C. Render Judul "SME"
        if(smeList.length > 0) {
            list.innerHTML += `
            <div style="padding: 20px 15px 5px 15px; background:var(--bg-body); border-bottom:1px solid var(--border);">
                <span style="font-size:11px; font-weight:700; color:#a855f7; text-transform:uppercase; letter-spacing:1px;">
                    <i class="ph ph-lightning" style="margin-right:4px;"></i> SME / Support
                </span>
            </div>`;
            smeList.forEach(agent => {
                list.innerHTML += createAgentItem(agent, agent.originalIndex);
            });
        }

        // Jika Kosong
        if(tlList.length === 0 && smeList.length === 0) {
            list.innerHTML = `<div style="padding:20px; text-align:center; color:#94a3b8; font-size:13px;">No Support staff found.</div>`;
        }

    } else {
        // --- STEP 3: LOGIKA RENDERING BIASA (HIJRYAN, SILVIA, DST) ---
        
        let filteredData = baseData;
        
        if (selectedTagFilter !== 'ALL') {
            filteredData = filteredData.filter(agent => agent.spv === selectedTagFilter);
        }

        if(filteredData.length === 0) {
            list.innerHTML = `<div style="padding:20px; text-align:center; color:#94a3b8; font-size:13px;">No agent found.</div>`;
            return;
        }

        filteredData.sort((a, b) => a.name.localeCompare(b.name));

        filteredData.forEach(agent => {
            list.innerHTML += createAgentItem(agent, agent.originalIndex);
        });
    }
}

function renderAlphabetBar() {
    const container = document.getElementById('alphabetContainer');
    if(!container) return;
    
    container.innerHTML = "";
    
    // 1. Tombol 'ALL' (Semua)
    const allBtn = document.createElement("div");
    allBtn.className = `alpha-btn ${selectedFilterLetter === 'ALL' ? 'active' : ''}`;
    allBtn.innerText = "ALL";
    allBtn.onclick = () => {
        selectedFilterLetter = 'ALL';
        renderAlphabetBar(); // Re-render biar warna aktif pindah
        renderAgentList();   // Refresh list
    };
    container.appendChild(allBtn);
    
    // 2. Tombol A - Z
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    
    alphabet.forEach(letter => {
        const btn = document.createElement("div");
        // Cek apakah huruf ini aktif?
        const isActive = (selectedFilterLetter === letter);
        
        btn.className = `alpha-btn ${isActive ? 'active' : ''}`;
        btn.innerText = letter;
        
        btn.onclick = () => {
            // Jika diklik lagi, reset ke ALL (Toggle)
            if(selectedFilterLetter === letter) selectedFilterLetter = 'ALL';
            else selectedFilterLetter = letter;
            
            renderAlphabetBar(); // Update tampilan tombol
            renderAgentList();   // Filter list
        };
        
        container.appendChild(btn);
    });
}

function renderTagsBar() {
    const container = document.getElementById('tagsContainer');
    if(!container) return;
    
    container.innerHTML = "";
    
    // 1. Ambil semua nama SPV/Tim yang unik dari masterData secara otomatis
    const activeTeams = [...new Set(masterData.map(agent => agent.spv))].filter(team => team);
    
    // 2. Susun daftar Tag (Mulai dengan 'ALL', lalu tim yang aktif, lalu 'Support')
    // Kita filter 'Support' agar tidak ganda karena nanti akan ditambah manual di akhir
    const finalTags = ["ALL", ...activeTeams.filter(t => t !== "Support"), "Support"];
    
    finalTags.forEach(tag => {
        const btn = document.createElement("div");
        const isActive = (selectedTagFilter === tag);
        
        btn.className = `tag-btn ${isActive ? 'active' : ''}`;
        
        // Label tampilan
        if(tag === "ALL") {
            btn.innerText = "All Teams";
        } 
        else {
            btn.innerText = tag;
        }
        
        btn.onclick = () => {
            if (selectedTagFilter === tag && tag !== "ALL") {
                selectedTagFilter = 'ALL';
            } else {
                selectedTagFilter = tag;
            }
            renderTagsBar();   
            renderAgentList(); 
        };
        
        container.appendChild(btn);
    });
}

function openModal(mode, idx) {
    if(!checkPermission()) return; 
    
    // --- TAMBAHKAN KODE INI UNTUK UPDATE DROPDOWN TEAM SECARA DINAMIS ---
    const teamSelect = document.getElementById('modalTeam');
    if (teamSelect) {
        // Ambil semua nama unik dari agent yang memiliki role TL
        const activeTLs = [...new Set(masterData.filter(a => a.role === "TL").map(a => a.name))];
        
        // Simpan pilihan Support jika belum ada
        if (!activeTLs.includes("Support")) activeTLs.push("Support");

        teamSelect.innerHTML = ""; // Kosongkan pilihan lama
        activeTLs.forEach(tlName => {
            const opt = document.createElement('option');
            opt.value = tlName;
            opt.text = tlName;
            teamSelect.appendChild(opt);
        });
    }    
    
    const modal = document.getElementById('agentModal');
    const passInput = document.getElementById('modalAgentPassword');
    const eyeIcon = document.getElementById('eyeAgent');
    
    // Reset Tampilan Icon Mata & Input Type
    if(passInput) passInput.type = "password";
    if(eyeIcon) eyeIcon.className = "ph ph-eye";

    modal.style.display = 'flex';
    document.getElementById('editIndex').value = mode === 'add' ? -1 : idx;
    
    if(mode !== 'add') {
        // MODE EDIT: Isi data agent yang ada
        const agent = masterData[idx];
        document.getElementById('modalTitle').innerText = "Edit Agent";
        document.getElementById('modalName').value = agent.name;
        document.getElementById('modalTeam').value = agent.spv;
        document.getElementById('modalRole').value = agent.role || "Agent"; 
        
        // [BARU] Isi Password
        // Jika password belum ada (data lama), default ke "123456"
        if(passInput) passInput.value = agent.password || "123456";
        
    } else { 
        // MODE ADD: Kosongkan form
        document.getElementById('modalTitle').innerText = "Add New Agent";
        document.getElementById('modalName').value = ""; 
        document.getElementById('modalRole').value = "Agent"; 
        
        // [BARU] Default Password untuk Agent Baru
        if(passInput) passInput.value = "123456"; 
    }
}

function saveAgent() {
    if(!checkPermission()) return; 
    
    const name = document.getElementById('modalName').value;
    const spv = document.getElementById('modalTeam').value;
    const role = document.getElementById('modalRole').value; 
    
    // [BARU] Ambil value password
    const password = document.getElementById('modalAgentPassword').value;
    
    const idx = document.getElementById('editIndex').value;

    if(!name) return alert("Name required!");
    if(!password) return alert("Password required!"); // Validasi

    if(idx == -1) { 
        // LOGIKA TAMBAH BARU
        masterData.push({ 
            name, 
            spv, 
            role,
            password: password // Simpan password input
        }); 
        shiftDataCurrent.push([0,0,0,0,0,0,0]); 
        shiftDataNext.push([0,0,0,0,0,0,0]); 
    } else { 
        // LOGIKA EDIT (UPDATE)
        masterData[idx].name = name; 
        masterData[idx].spv = spv; 
        masterData[idx].role = role; 
        masterData[idx].password = password; // Update password
    }
    
    document.getElementById('agentModal').style.display='none';
    saveAll(); refreshAllViews();
    showToast("Agent Data Saved!", "success");
}

function deleteAgent(idx) {
    if(!checkPermission()) return; 
    askConfirmation('delete_agent', idx);
}

function resetAll() { 
    if(!checkPermission()) return; 
    
    // [GANTI] Pakai Modal Kustom
    askConfirmation('reset');
}


// ==========================================================
// 7. UTILITIES (IMPORT, EXPORT, REPORT)
// ==========================================================

// Variabel sementara untuk menampung data import
let tempImportData = null;

function importRawJson() {
    if(!checkPermission()) return; 
    const rawText = document.getElementById('jsonImportArea').value;
    if (!rawText.trim()) return alert("JSON Area Empty!");
    
    try {
        const parsedData = JSON.parse(rawText);
        if (Array.isArray(parsedData.master) && Array.isArray(parsedData.shifts)) {
            
            // Simpan ke variabel sementara
            tempImportData = parsedData;
            
            // Tampilkan Konfirmasi Modal
            askConfirmation('import_json');
            
        } else { 
            alert("Invalid JSON Format!"); 
        }
    } catch (e) { 
        alert("Error Parsing JSON"); 
    }
}

// Fungsi pembantu yang dipanggil oleh executeConfirmedAction
function finalizeImport() {
    if (tempImportData) {
        masterData = tempImportData.master;
        shiftDataCurrent = tempImportData.shifts;
        shiftDataNext = tempImportData.shiftsNext || Array(masterData.length).fill().map(()=>Array(7).fill(0));
        bulletinMessage = tempImportData.bulletin || "";
        
        saveAll(); refreshAllViews();
        showToast("Database Restored!", "success");
        
        tempImportData = null; // Reset
    }
}

function copyCurrentJson() {
    const jsonString = JSON.stringify({ 
        master: masterData, 
        shifts: shiftDataCurrent, 
        shiftsNext: shiftDataNext,
        bulletin: bulletinMessage
    }, null, 2);
    document.getElementById('jsonImportArea').value = jsonString;
    navigator.clipboard.writeText(jsonString);
    showToast("JSON Copied to Clipboard!", "success");
}

// --- SMART DOWNLOAD (Admin vs User) ---
function downloadScheduleAsImage() {
    
    // --- SKENARIO 1: ADMIN (DOWNLOAD FULL TABLE) ---
    if (isAdmin) {
        const elementToCapture = document.getElementById("mainContainer");
        
        // Validasi: Apakah tabel ada isinya?
        if(!elementToCapture || elementToCapture.innerText.trim() === "") {
            return showToast("Table is empty!", "error");
        }

        showToast("Capturing Full Schedule...", "process");

        // Gunakan background sesuai tema saat ini
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        const bgColor = isDark ? '#1e293b' : '#ffffff';

        html2canvas(elementToCapture, {
            scale: 2, // Resolusi Tinggi
            backgroundColor: bgColor,
            useCORS: true
        }).then(canvas => {
            const link = document.createElement('a');
            // Nama file: Full_Schedule_Jam_Tanggal.png
            link.download = 'Full_Schedule_' + new Date().getTime() + '.png';
            link.href = canvas.toDataURL("image/png");
            link.click();
            showToast("Full Schedule Downloaded! 📂", "success");
        }).catch(err => {
            console.error(err);
            showToast("Failed to capture table.", "error");
        });

        return; // Hentikan fungsi di sini agar tidak lanjut ke logika User
    }


    // --- SKENARIO 2: USER BIASA (DOWNLOAD AESTHETIC CARD) ---
    
    // 1. Cek Apakah User Sudah Pilih Profil?
    const myId = localStorage.getItem('my_profile_id');
    if (myId === null) {
        return showToast("Please select your profile first!", "error");
    }

    showToast("Generating Aesthetic Card...", "process");

    // 2. Ambil Data User
    const agent = masterData[myId];
    const activeShifts = getActiveShiftData();
    const myShifts = activeShifts[myId];
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    // 3. Isi Template Tersembunyi
    document.getElementById('storyName').innerText = agent.name;
    document.getElementById('storyRole').innerText = `${agent.spv} Team • ${agent.role || 'Agent'}`;
    
    // Avatar
    const initials = getInitials(agent.name);
    const color = stringToColor(agent.name);
    const av = document.getElementById('storyAvatar');
    av.innerText = initials;
    av.style.backgroundColor = color;

    // Tanggal
    const date = new Date();
    document.getElementById('storyDate').innerText = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    // 4. Generate List Jadwal Vertikal
    const listContainer = document.getElementById('storyList');
    listContainer.innerHTML = ""; 

    myShifts.forEach((code, idx) => {
        let label = "OFF";
        let styleClass = "st-o";

        if (code === 1) { label = "MORNING"; styleClass = "st-p"; }
        else if (code === 2) { label = "AFTERNOON"; styleClass = "st-s"; }
        else if (code === 3) { label = "NIGHT"; styleClass = "st-m"; }
        else if (code === 4) { label = "LEAVE"; styleClass = "st-vl"; }
        else if (code === 5) { label = "LOA"; styleClass = "st-o"; }
        else if (code === 6) { label = "BIRTHDAY"; styleClass = "st-vl"; }

        const item = document.createElement('div');
        item.className = "story-item";
        item.innerHTML = `
            <div class="si-day">${days[idx]}</div>
            <div style="flex-grow:1; border-bottom:1px dashed rgba(255,255,255,0.1); margin:0 10px;"></div>
            <div class="si-status ${styleClass}">${label}</div>
        `;
        listContainer.appendChild(item);
    });

    // 5. Screenshot Template Card
    const elementToCapture = document.getElementById("storyTemplate");
    
    html2canvas(elementToCapture, {
        scale: 2, 
        backgroundColor: "#0f172a", 
        useCORS: true
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `My_Schedule_${agent.name.split(' ')[0]}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        
        showToast("Story Card Downloaded! ✨", "success");
        if (navigator.vibrate) navigator.vibrate([50, 50, 100]);
    }).catch(err => {
        console.error(err);
        showToast("Failed to generate card", "error");
    });
}

function exportToCSV() {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    let csvContent = "\uFEFFName,Team,Role," + days.join(",") + "\n";
    const activeShifts = getActiveShiftData();

    masterData.forEach((agent, idx) => {
        let row = `"${agent.name}","${agent.spv}","${agent.role || 'Agent'}",`;
        let shifts = [];
        for(let d=0; d<7; d++) {
            const val = activeShifts[idx][d];
            let code = "OFF";
            if(val === 1) code = "MORNING";
            else if(val === 2) code = "AFTERNOON";
            else if(val === 3) code = "NIGHT";
            else if(val === 4) code = "VL";
            else if(val === 5) code = "LOA";
            else if(val === 6) code = "BL";
            shifts.push(code);
        }
        row += shifts.join(",");
        csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Schedule_Export.csv";
    link.click();
    showToast("Excel/CSV Downloaded!", "success");
}

// --- LOGIKA LONG PRESS (TEKAN TAHAN) ---
let pressTimer;
let isLongPress = false;
let selectedCell = { idx: -1, day: -1 };

function startPress(idx, day) {
    // [PERBAIKAN KEAMANAN]
    // Cek apakah user adalah Admin?
    // Jika BUKAN admin, langsung berhenti. Menu tidak akan muncul.
    if (!isAdmin) return; 
    
    if (!isEditMode) return;

    isLongPress = false; // Reset status
    
    // Mulai timer 600ms (0.6 detik)
    pressTimer = setTimeout(() => {
        isLongPress = true; // Tandai ini sebagai Long Press
        openQuickMenu(idx, day);
        
        // Getar HP sedikit (Haptic Feedback) agar terasa mantap
        if (navigator.vibrate) navigator.vibrate(50);
    }, 600);
}

function cancelPress() {
    clearTimeout(pressTimer);
}

// Fungsi yang dipanggil saat tombol dilepas
function handleRelease(idx, day) {
    clearTimeout(pressTimer);
    
    // Jika user BUKAN admin, biarkan fungsi cycleShift yang menangani alert "Access Denied"
    // cycleShift sudah punya pengaman checkPermission() di dalamnya.
    
    if (!isLongPress) {
        // Jika hanya tap cepat (bukan tahan), jalankan fungsi ganti shift biasa
        cycleShift(idx, day);
    }
    
    // Reset status
    isLongPress = false;
}

// --- LOGIKA QUICK MENU ---
function openQuickMenu(idx, day) {
    // Double check keamanan
    if (!checkPermission()) return;
    
    selectedCell = { idx, day };
    document.getElementById('quickMenu').style.display = 'flex';
}

function closeQuickMenu() {
    document.getElementById('quickMenu').style.display = 'none';
}

function setShiftDirect(val) {
    // [PERBAIKAN KEAMANAN]
    // Pastikan user masih admin saat tombol diklik
    if (!checkPermission()) return;
    
    if (selectedCell.idx === -1) return;
    
    // Update data
    let targetArray = getActiveShiftData();
    targetArray[selectedCell.idx][selectedCell.day] = val;
    setActiveShiftData(targetArray);
    
    // Simpan & Refresh
    saveAll();
    refreshAllViews();
    closeQuickMenu();
}


// =========================================
// FITUR REPORT WHATSAPP (MINIMALIST / CLEAN)
// =========================================

function copyScheduleText() {
    // 1. SETUP TANGGAL
    const date = new Date();
    // Format: "Sunday, 25 Jan 2026"
    const dateString = date.toLocaleDateString('en-GB', { 
        weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' 
    });
    
    // Setup Index Hari
    const jsDay = date.getDay(); 
    let todayIdx = jsDay - 1; 
    if (todayIdx === -1) todayIdx = 6; 

    const activeShifts = getActiveShiftData();
    
    // 2. GROUPING DATA
    let groups = { "MORNING": [], "AFTERNOON": [], "NIGHT": [] };

    // 3. FILL DATA
    masterData.forEach((agent, idx) => {
        const val = activeShifts[idx][todayIdx];
        
        // Skip OFF/VL/LOA/BL
        if (val === 0 || val === 4 || val === 5 || val === 6) return; 
        
        let dName = agent.name;
        let isPriority = 2; 

        // Formatting Nama (Clean, tanpa emoji)
        if (agent.role === "TL") {
            dName = `*${dName}* (TL)`; // Bold untuk TL
            isPriority = 0;
        } 
        else if (agent.role === "SME") {
            dName = `${dName} (SME)`;
            isPriority = 1;
        }

        const entry = { name: dName, priority: isPriority };

        if (val === 1) groups["MORNING"].push(entry);
        else if (val === 2) groups["AFTERNOON"].push(entry);
        else if (val === 3) groups["NIGHT"].push(entry);
    });

    // 4. GENERATE CLEAN REPORT
    // Header Simpel & Tegas
    let report = `*DAILY SHIFT REPORT*\n`;
    report += `${dateString.toUpperCase()}\n`; // Uppercase agar terlihat formal
    report += `──────────────────────\n`;

    const renderSection = (title, list) => {
        if (list.length === 0) return "";
        
        // Sorting: TL -> SME -> Abjad
        list.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return a.name.localeCompare(b.name);
        });

        // Format Section: "MORNING [9]"
        let section = `\n*${title}* [${list.length}]\n`;
        list.forEach(item => {
            // Gunakan bullet point simpel
            section += `• ${item.name}\n`; 
        });
        return section;
    };

    report += renderSection("MORNING", groups["MORNING"]);
    report += renderSection("AFTERNOON", groups["AFTERNOON"]);
    report += renderSection("NIGHT", groups["NIGHT"]);

    report += `\n──────────────────────\n`;
    report += `_Generated by Shift Manager_`;

    // 5. COPY ACTION
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(report).then(() => {
            showToast("Report Copied!", "success");
        }).catch(err => fallbackCopyText(report));
    } else {
        fallbackCopyText(report);
    }
}

// ==========================================================
// 8. THEME & UI HELPERS
// ==========================================================

function initTheme() {
    const savedTheme = localStorage.getItem('shift_theme');
    const icon = document.getElementById('themeIconMenu');
    
    if (savedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        if(icon) { icon.classList.remove('ph-moon'); icon.classList.add('ph-sun'); }
        document.getElementById('themeText').innerText = "Light Mode";
    }
}

function toggleTheme() {
    const current = document.body.getAttribute('data-theme');
    const icon = document.getElementById('themeIconMenu');
    
    if (current === 'dark') {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('shift_theme', 'light');
        if(icon) { icon.classList.remove('ph-sun'); icon.classList.add('ph-moon'); }
        document.getElementById('themeText').innerText = "Dark Mode";
    } else {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('shift_theme', 'dark');
        if(icon) { icon.classList.remove('ph-moon'); icon.classList.add('ph-sun'); }
        document.getElementById('themeText').innerText = "Light Mode";
    }
    toggleMenu(); 
}

// --- TOAST NOTIFICATION ---
function showToast(msg, type="default") {
    const toast = document.getElementById("saveStatus");
    if(!toast) return;
    
    // Icon Logic
    let iconHTML = '<i class="ph ph-info"></i>';
    let bgColor = "#10b981"; // Success Green

    if(type === "process") {
        iconHTML = '<i class="ph ph-spinner-gap ph-spin"></i>';
        bgColor = "#3b82f6"; // Blue
    } else if (type === "error") {
        iconHTML = '<i class="ph ph-warning-circle"></i>';
        bgColor = "#ef4444"; // Red
    }

    toast.innerHTML = `${iconHTML} <span>${msg}</span>`;
    toast.style.background = bgColor;
    
    // Show
    toast.style.opacity = "1";
    toast.style.top = "30px"; // Slide down effect

    // Hide automatically
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.top = "20px";
    }, 3000);
}

function updateTimeBadge() {
    const el = document.getElementById("lastUpdateBadge");
    if(el) {
        // Gunakan innerHTML agar icon tidak hilang
        el.innerHTML = `<i class="ph ph-clock"></i> Updated: ${lastUpdateTime}`;
    }
}

function toggleBulletin() {
    const content = document.getElementById('bulletinContent');
    const arrow = document.getElementById('bulletinArrow');
    
    if(content.style.display === 'block') {
        content.style.display = 'none';
        arrow.style.transform = 'rotate(0deg)';
    } else {
        content.style.display = 'block';
        arrow.style.transform = 'rotate(180deg)';
    }
}

// ==========================================================
// 9. PROFILE HIGHLIGHTER
// ==========================================================

function populateProfileSelector() {
    const sel = document.getElementById('myProfileSelector');
    if(!sel) return;
    const savedId = localStorage.getItem('my_profile_id');

    sel.innerHTML = '<option value="-1">Select your name</option>';
    masterData.forEach((agent, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.text = agent.name;
        if(savedId == index) opt.selected = true; 
        sel.appendChild(opt);
    });
}

function setMyProfile() {
    const sel = document.getElementById('myProfileSelector');
    if(sel.value == -1) localStorage.removeItem('my_profile_id');
    else localStorage.setItem('my_profile_id', sel.value);
    
    refreshAllViews();
}

function highlightMyRow() {
    // Logic sudah terintegrasi di renderTables (class='my-row')
}

function toggleRowHighlight(index) {
    const allRows = document.querySelectorAll("tbody tr");
    allRows.forEach(r => r.classList.remove("selected-row"));
    const targetRow = document.getElementById(`row-${index}`);
    if(targetRow) targetRow.classList.add("selected-row");
}

// ==========================================================
// 10. INTERACTIVE LEGEND
// ==========================================================
function renderInteractiveLegend() {
    const container = document.getElementById('interactiveLegend');
    if(!container) return;
    container.innerHTML = ""; 

    const legends = [
        { code: 1, label: "Morning", color: "var(--shift-p)" },
        { code: 2, label: "Afternoon", color: "var(--shift-s)" },
        { code: 3, label: "Night", color: "var(--shift-m)" },
        { code: 0, label: "OFF", color: "var(--shift-o)" },
        { code: 5, label: "LOA", color: "var(--shift-loa)" },
        { code: 4, label: "VL", color: "var(--shift-vl)" }
    ];

    const resetBtn = document.createElement("div");
    resetBtn.className = "legend-item";
    resetBtn.innerHTML = "<i class='ph ph-arrows-clockwise'></i> Show All";
    resetBtn.onclick = () => clearHighlight();
    container.appendChild(resetBtn);

    legends.forEach(item => {
        const div = document.createElement("div");
        div.className = "legend-item";
        div.innerHTML = `<span class="legend-dot" style="background:${item.color}"></span> ${item.label}`;
        div.onclick = () => highlightShiftType(item.code);
        container.appendChild(div);
    });
}

function highlightShiftType(targetCode) {
    document.body.classList.add('filtering-mode');
    const allBtns = document.querySelectorAll('.cell-btn');
    allBtns.forEach(btn => {
        btn.classList.remove('highlighted-shift');
        // Match Code Text
        const targetObj = shiftTypes[targetCode];
        if (targetObj && btn.innerText.trim() === targetObj.code) {
            btn.classList.add('highlighted-shift');
        }
    });
}

function clearHighlight() {
    document.body.classList.remove('filtering-mode');
    document.querySelectorAll('.cell-btn').forEach(btn => btn.classList.remove('highlighted-shift'));
}


// =========================================
// LOGIKA KONFIRMASI AKSI (CONSISTENT POP-UP)
// =========================================

// Global Variables untuk menyimpan status aksi
var pendingActionType = null; 
var pendingActionData = null; // [BARU] Untuk menyimpan data tambahan (misal: index agent yg mau dihapus)

// Fungsi Membuka Modal Konfirmasi
function askConfirmation(type, data = null) {
    const modal = document.getElementById('confirmActionModal');
    const msgEl = document.getElementById('confirmMessageText');
    
    if(!modal || !msgEl) return; // Safety check

    // Simpan tipe aksi dan data (jika ada)
    pendingActionType = type;
    pendingActionData = data;
    
    // ATUR PESAN SESUAI TIPE AKSI
    let message = "Are you sure?";

    if (type === 'image') {
        // Cek Admin atau Bukan untuk pesan yang pas
        if (isAdmin) {
            message = "Download Full Schedule Table?";
        } else {
            message = "Generate Aesthetic Story Card?";
        }
    }   
    else if (type === 'report') message = "Copy Report to WhatsApp?";
    else if (type === 'excel') message = "Export Data to Excel?";
    
    // --- TAMBAHAN BARU ---
    else if (type === 'logout') message = "Are you sure you want to Logout?";
    else if (type === 'reset') message = "⚠️ RESET ALL SHIFTS? This cannot be undone.";
    else if (type === 'delete_agent') message = `Delete agent "${masterData[data].name}" permanently?`;
    else if (type === 'rollover') message = "⚠️ Overwrite THIS WEEK with NEXT WEEK data?";
    else if (type === 'import_json') message = "⚠️ Overwrite Database with this JSON?";
    else if (type === 'restore_default') message = "Restore default settings?";
   
    // [TAMBAHAN BARU]
    else if (type === 'clear_logs') message = "⚠️ Clear ALL login history? This cannot be undone.";
    else if (type === 'swap') message = "Confirm shift swap for selected agents?";  

    msgEl.innerText = message;
    
    // Tampilkan Modal
    modal.style.display = 'flex';
}

function closeConfirmModal() {
    const modal = document.getElementById('confirmActionModal');
    if(modal) modal.style.display = 'none';
    
    // Reset variabel setelah delay animasi (agar tidak konflik jika dibuka cepat)
    setTimeout(() => { 
        pendingActionType = null; 
        pendingActionData = null;
    }, 500);
}

// Fungsi Eksekusi Saat Tombol "Yes, Proceed" Diklik
// Fungsi Eksekusi Saat Tombol "Yes, Proceed" Diklik
function executeConfirmedAction() {
    // 1. AMBIL & AMANKAN DATA DULU (Penting!)
    // Kita simpan ke variabel lokal agar tidak hilang saat modal ditutup
    const action = pendingActionType;
    const data = pendingActionData; 
    
    // 2. Tutup modal
    const modal = document.getElementById('confirmActionModal');
    if(modal) modal.style.display = 'none';

    // 3. Reset variabel global agar bersih untuk aksi berikutnya
    pendingActionType = null;
    pendingActionData = null;

    // 4. Eksekusi Aksi (dengan jeda sedikit agar mulus)
    setTimeout(() => {
        
        // --- EXISTING ACTIONS ---
        if (action === 'image') downloadScheduleAsImage();
        else if (action === 'report') copyScheduleText();
        else if (action === 'excel') exportToCSV();
        else if (action === 'logout') doLogout();
        
        // --- RESET SHIFTS ---
        else if (action === 'reset') {
            if(currentViewMode === 'current') {
                shiftDataCurrent = shiftDataCurrent.map(()=>[0,0,0,0,0,0,0]);
            } else {
                shiftDataNext = shiftDataNext.map(()=>[0,0,0,0,0,0,0]);
            }
            saveAll(); refreshAllViews();
            showToast("Schedule Reset Successful", "success");
        }

        // --- DELETE AGENT ---
        else if (action === 'delete_agent') {
            if (data !== null && data > -1) {
                masterData.splice(data, 1); 
                shiftDataCurrent.splice(data, 1); 
                shiftDataNext.splice(data, 1); 
                saveAll(); refreshAllViews(); 
                showToast("Agent Deleted", "success");
            }
        }

        // --- ROLLOVER ---
        else if (action === 'rollover') {
            shiftDataCurrent = JSON.parse(JSON.stringify(shiftDataNext));
            shiftDataNext = Array(masterData.length).fill().map(() => Array(7).fill(0));
            currentViewMode = 'current';
            document.getElementById('weekSelector').value = 'current';
            saveAll(); refreshAllViews();
            showToast("Roll Over Successful!", "success");
        }

        // --- IMPORT & RESTORE ---
        else if (action === 'import_json') finalizeImport();
        
        else if (action === 'clear_logs') {
            accessLogs = []; 
            saveAllSilent(); 
            openLogHistoryModal(); 
            showToast("Login History Cleared!", "success");
        }

        // --- [FIX] SWAP SHIFTS ---
        else if (action === 'swap') {
            // Safety Check: Pastikan data ada
            if (!data || !data.agent1 || !data.agent2) {
                return showToast("Swap failed: Missing data.", "error");
            }

            const idx1 = parseInt(data.agent1); // Pastikan angka
            const idx2 = parseInt(data.agent2); // Pastikan angka
            const days = data.days;

            let targetArray = getActiveShiftData();

            // Proses Tukar Jadwal
            days.forEach(dayStr => {
                const d = parseInt(dayStr); // Pastikan index hari angka
                
                // Simpan nilai lama Agent 1
                const temp = targetArray[idx1][d];
                
                // Tukar
                targetArray[idx1][d] = targetArray[idx2][d];
                targetArray[idx2][d] = temp;
            });
            
            // Simpan Perubahan
            // Note: setActiveShiftData sebenarnya tidak wajib jika kita mengedit array by reference,
            // tapi kita panggil untuk memastikan konsistensi pointer.
            setActiveShiftData(targetArray);
            
            saveAll(); 
            refreshAllViews(); 
            
            // Reset Checkbox di UI
            document.querySelectorAll('.swap-day').forEach(cb => cb.checked = false);
            
            showToast("Shifts Swapped Successfully!", "success");
        }

    }, 300); // Delay 300ms
}

function requestClearLogs() {
    // Cek apakah ada log untuk dihapus
    if (!accessLogs || accessLogs.length === 0) {
        return showToast("Log is already empty.", "error");
    }
    
    // Hanya Admin yang boleh hapus (Opsional, hapus baris ini jika semua boleh hapus)
    if (!isAdmin) {
        showAccessDeniedModal();
        return;
    }

    // Panggil Modal Konfirmasi
    askConfirmation('clear_logs');
}



// START APP
initData();

// =========================================
// LOGIKA INITIAL LOCK SCREEN (WAJIB ADA)
// =========================================

// 1. Fungsi untuk mengisi Dropdown Nama (Dipanggil saat initData)
function prepareLockScreen() {
    const sel = document.getElementById('loginUserSelect');
    if(!sel) return; 
    
    sel.innerHTML = ""; 

    // Opsi Admin
    const optAdmin = document.createElement('option');
    optAdmin.value = "ADMIN_SYSTEM";
    optAdmin.text = "Administrator";
    optAdmin.style.fontWeight = "bold";
    sel.appendChild(optAdmin);

    // Separator
    const optSep = document.createElement('option');
    optSep.disabled = true;
    optSep.text = "──────────────";
    sel.appendChild(optSep);

    // Masukkan Agent (Diurutkan A-Z)
    if(masterData && masterData.length > 0) {
        const sortedAgents = [...masterData].map((agent, index) => ({...agent, originalIndex: index}))
                                            .sort((a, b) => a.name.localeCompare(b.name));

        sortedAgents.forEach(agent => {
            const opt = document.createElement('option');
            opt.value = agent.originalIndex; 
            opt.text = agent.name;
            sel.appendChild(opt);
        });
    }
}

// 2. Fungsi Tombol Mata (Lihat Password) - INI YANG MISSING
function toggleInitialPassword() {
    const input = document.getElementById('initialPassInput');
    const icon = document.getElementById('eyeIconInitial');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('ph-eye');
        icon.classList.add('ph-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('ph-eye-slash');
        icon.classList.add('ph-eye');
    }
}

// 3. Fungsi Tombol "Unlock Dashboard" - INI YANG MISSING
// A. UPDATE LOGIKA LOGIN (Cari fungsi processInitialLogin dan TIMPA bagian Skenario Agent)
function processInitialLogin() {
    const userVal = document.getElementById('loginUserSelect').value;
    const passVal = document.getElementById('initialPassInput').value;
    const isRemember = document.getElementById('rememberMe').checked;
    const PASS_ADMIN = "ipulyganteng";
    let loginSuccess = false; 

    const recordLogin = (name, role) => {
        const now = new Date();
        const timeString = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + " • " + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        if(!accessLogs) accessLogs = [];
        accessLogs.unshift({ name: name, role: role, time: timeString });
        if(accessLogs.length > 50) accessLogs.pop();
    };

    if (userVal === "ADMIN_SYSTEM") {
        if (passVal === PASS_ADMIN) {
            isAdmin = true;
            loginSuccess = true;
            localStorage.setItem('SHIFT_APP_SESSION', 'ADMIN');
            recordLogin("Administrator", "Super User");
        } else {
            alert("Wrong Admin Password!");
        }
    } else {
        const agent = masterData[userVal];
        if (agent) {
            const correctPass = agent.password || "123456";
            if (passVal == correctPass) {
                isAdmin = false; 
                loginSuccess = true;
                localStorage.setItem('my_profile_id', userVal);
                localStorage.setItem('SHIFT_APP_SESSION', 'AGENT');
                recordLogin(agent.name, "Agent");
                if(passVal === "123456") {
                    setTimeout(() => { showSecurityWarning(); }, 800);
                }
            } else {
                alert("Wrong Password for " + agent.name);
            }
        }
    }

    if (loginSuccess) {
        if (isRemember) {
            const expiryDate = new Date().getTime() + (30 * 24 * 60 * 60 * 1000);
            localStorage.setItem('SHIFT_REMEMBER_EXPIRY', expiryDate);
        } else {
            localStorage.removeItem('SHIFT_REMEMBER_EXPIRY');
        }
        finishLoginProcess();
        showToast("Login Success!", "success");
    }
}


function checkAutoLogin() {
    const session = localStorage.getItem('SHIFT_APP_SESSION');
    const expiry = localStorage.getItem('SHIFT_REMEMBER_EXPIRY');
    const now = new Date().getTime();

    if (session && expiry) {
        if (now < parseInt(expiry)) {
            // Session masih valid, langsung masuk ke dashboard
            finishLoginProcess();
            return true;
        } else {
            // Session sudah expired, hapus data lama
            localStorage.removeItem('SHIFT_APP_SESSION');
            localStorage.removeItem('SHIFT_REMEMBER_EXPIRY');
        }
    }
    return false;
}


// B. TAMBAHKAN FUNGSI BARU DI PALING BAWAH FILE
// =========================================
// LOGIKA MODAL AKUN & SECURITY
// =========================================

// 1. Fungsi Buka Modal "My Account" (Yang tadi tidak jalan)
// 1. Fungsi Helper Toggle Password (Wajib ada)
function togglePass(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    
    // Safety Check: Pastikan elemen ada sebelum diubah
    if (!input || !icon) return;
    
    if (input.type === "password") {
        input.type = "text";
        icon.classList.remove("ph-eye");
        icon.classList.add("ph-eye-slash");
    } else {
        input.type = "password";
        icon.classList.remove("ph-eye-slash");
        icon.classList.add("ph-eye");
    }
}

// 2. Fungsi Utama Modal Akun (VERSI BARU)
function openAccountModal() {
    const myId = localStorage.getItem('my_profile_id');
    const modal = document.getElementById('accountModal');
    
    // Safety Check: Pastikan Modal HTML sudah dipasang
    if(!modal) return alert("Error: HTML Modal Akun belum dipasang/salah ID.");

    // Reset Input & Icon ke kondisi awal (tertutup)
    const inpNew = document.getElementById('accNewPass');
    const inpCurr = document.getElementById('accCurrentPass');
    const eye1 = document.getElementById('eye1');
    const eye2 = document.getElementById('eye2');

    if(inpNew) { inpNew.value = ""; inpNew.type = "password"; }
    if(inpCurr) { inpCurr.type = "password"; }
    if(eye1) { eye1.className = "ph ph-eye"; }
    if(eye2) { eye2.className = "ph ph-eye"; }

    // --- SKENARIO 1: ADMIN ---
    if (isAdmin) {
        document.getElementById('profileAvatarBig').innerText = "A";
        document.getElementById('profileAvatarBig').style.background = "#f59e0b"; // Orange
        document.getElementById('profileNameBig').innerText = "Administrator";
        document.getElementById('profileRoleBig').innerText = "Super User";
        
        if(inpCurr) inpCurr.value = "ipulyganteng"; // Admin pass hardcoded
        
        modal.style.display = 'flex';
        return;
    }

    // --- SKENARIO 2: AGENT ---
    if (myId && masterData[myId]) {
        const agent = masterData[myId];
        
        // 1. Set Nama & Role
        document.getElementById('profileNameBig').innerText = agent.name;
        document.getElementById('profileRoleBig').innerText = agent.role || "Agent";
        
        // 2. Set Avatar Inisial (Logic MSF)
        const initials = agent.name
            .split(' ')
            .map(word => word[0])
            .join('')
            .substring(0, 3)
            .toUpperCase();
            
        const avatarEl = document.getElementById('profileAvatarBig');
        avatarEl.innerText = initials;
        avatarEl.style.background = "#3b82f6"; // Biru Default

        // 3. Set Current Password
        if(inpCurr) inpCurr.value = agent.password || "123456";

        modal.style.display = 'flex';
    } else {
        // Jika profil tidak ditemukan (misal habis clear cache), minta login ulang
        alert("Session expired. Please login again.");
        location.reload();
    }
}


// 2. Fungsi Simpan Password Baru
function saveNewPassword() {
    const myId = localStorage.getItem('my_profile_id');
    const newPass = document.getElementById('accNewPass').value;

    if (!newPass || newPass.length < 4) {
        alert("Password too short! Minimum 4 characters.");
        return;
    }

    if (myId && masterData[myId]) {
        masterData[myId].password = newPass;
        
        // Simpan ke server (JSONBin)
        if(typeof saveAllSilent === "function") {
            saveAllSilent();
        } else {
            // Fallback jika fungsi silent belum ada
            console.warn("saveAllSilent not found, saving locally only for now.");
        }
        
        document.getElementById('accountModal').style.display = 'none';
        showToast("Password Updated Successfully!", "success");
    }
}

// 3. Fungsi Security Warning (Pop-up Kuning)
function showSecurityWarning() {
    const modal = document.getElementById('securityWarningModal');
    if(modal) modal.style.display = 'flex';
}

function closeSecurityWarning() {
    document.getElementById('securityWarningModal').style.display = 'none';
}

// 4. Shortcut dari Warning langsung ke Ganti Password
function openChangePasswordDirectly() {
    // 1. Coba tutup warning dulu
    const warningModal = document.getElementById('securityWarningModal');
    if (warningModal) {
        warningModal.style.display = 'none';
    }

    // 2. Coba buka modal akun
    const accountModal = document.getElementById('accountModal');
    if (accountModal) {
        // Panggil fungsi pembuka yang sudah ada logic pengisian datanya
        openAccountModal(); 
    } else {
        // JIKA HTML HILANG, TAMPILKAN ALERT (Bukan Error Console)
        alert("ERROR: Modal Akun hilang dari index.html! Silakan copy kode HTML langkah no 1.");
    }
}

// 4. Fungsi Penutup (Membuka Dashboard)
function finishLoginProcess() {
    // 1. Sembunyikan Lock Screen
    const modal = document.getElementById('initialAuthModal');
    if(modal) modal.style.display = 'none';

    // 2. Jalankan render UI
    populateProfileSelector(); // Dropdown tetap diisi untuk keperluan logic
    highlightMyRow(); 
    renderAlphabetBar();
    renderTagsBar();
    refreshAllViews();
    
    // 3. Update UI Admin
    updateUIForAdmin();

    // ===============================================
    // [UPDATE] LOGIKA TAMPILAN PROFILE (KARTU VS DROPDOWN)
    // ===============================================
    const dropdownWrapper = document.getElementById('profileSelectWrapper');
    const cardWrapper = document.getElementById('lockedProfileCard');

    if (!isAdmin) {
        // --- MODE AGENT (TAMPILKAN KARTU) ---
        if(dropdownWrapper) dropdownWrapper.style.display = 'none'; // Sembunyikan Dropdown
        if(cardWrapper) cardWrapper.style.display = 'flex';         // Tampilkan Kartu

        // Isi Data ke Kartu
        // Ambil ID profil dari localStorage
        const myId = localStorage.getItem('my_profile_id');
        
        if (myId !== null && masterData[myId]) {
            const agent = masterData[myId];
            
            // Set Nama
            document.getElementById('lpName').innerText = agent.name;
            
            // Set Avatar (Inisial & Warna)
            const initials = getInitials(agent.name);
            const color = stringToColor(agent.name);
            
            const avatarEl = document.getElementById('lpAvatar');
            avatarEl.innerText = initials;
            avatarEl.style.backgroundColor = color;
        }

    } else {
        // --- MODE ADMIN (TAMPILKAN DROPDOWN) ---
        if(dropdownWrapper) dropdownWrapper.style.display = 'block';
        if(cardWrapper) cardWrapper.style.display = 'none';
        
        // Pastikan dropdown aktif
        const sel = document.getElementById('myProfileSelector');
        if(sel) sel.disabled = false;
    }
    updateHeaderGreeting();
    forceOpenScheduleTab(); 
}

function openLogHistoryModal() {
    const modal = document.getElementById('logHistoryModal');
    if (!modal) return;

    const list = document.getElementById('logListContainer');
    list.innerHTML = "";

    // 1. Cek Data Kosong
    if (!accessLogs || accessLogs.length === 0) {
        list.innerHTML = `<li style="padding:40px 20px; text-align:center; color:var(--text-sub); display:flex; flex-direction:column; align-items:center; gap:10px;">
            <i class="ph ph-scroll" style="font-size:32px; opacity:0.3;"></i>
            <span style="font-size:13px;">No login history found.</span>
        </li>`;
    } else {
        // 2. Render List
        accessLogs.forEach(log => {
            const li = document.createElement('li');
            li.style.cssText = "padding: 12px 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;";

            // LOGIKA INISIAL & ICON
            let initials = "";
            let bgClass = "avatar-agent"; // Default Biru

            if (log.role === 'Super User' || log.name === 'Administrator') {
                // HILANGKAN MAHKOTA, GANTI JADI "A"
                initials = "A";
                bgClass = "avatar-admin"; // Orange (Pastikan CSS avatar-admin sudah ada di style.css)
            } else {
                // KASUS AGENT: Ambil inisial (Misal: MSF)
                initials = log.name
                    .split(' ')
                    .map(word => word[0])
                    .join('')
                    .substring(0, 3)
                    .toUpperCase();
            }

            // HTML Item
            li.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <div class="log-avatar ${bgClass}">
                        ${initials}
                    </div>
                    
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-weight:600; font-size:13px; color:var(--text-main);">${log.name}</span>
                        <span style="font-size:11px; color:var(--text-sub);">${log.role}</span>
                    </div>
                </div>
                <div style="font-size:10px; font-weight:600; color:var(--text-sub); background:var(--bg-input); padding:4px 8px; border-radius:6px;">
                    ${log.time.split('•')[1] || log.time}
                </div>
            `;
            list.appendChild(li);
        });
    }

    modal.style.display = 'flex';
}

// --- DYNAMIC HEADER LOGIC (ALL FEATURES COMBINED) ---
function updateHeaderGreeting() {
    const titleEl = document.getElementById('appTitle');
    const subEl = document.getElementById('appSubtitle');
    const dividerEl = document.getElementById('headerDivider');
    const myId = localStorage.getItem('my_profile_id');

    // 1. JIKA BELUM LOGIN (Tampilkan Default Selamanya)
    if (myId === null || !masterData[myId]) {
        titleEl.innerText = "Shift Manager Promotion"; 
        titleEl.classList.remove('personalized-title');
        subEl.innerText = "Daily Dashboard";
        subEl.className = ""; 
        if(dividerEl) dividerEl.style.display = "inline";
        return;
    }

    // 2. LOGIKA ROTASI (GREETING vs APP TITLE)
    if (headerGreetingMode) {
        // --- MODE 1: SAPAAN PERSONAL (GREETING) ---
        
        const agent = masterData[myId];
        
        // Ambil 2 Kata Pertama dari Nama
        const displayName = agent.name.split(' ').slice(0, 2).join(' ');

        // Logika Waktu
        const h = new Date().getHours();
        let greet = "Hi";
        if (h >= 5 && h < 11) greet = "Good Morning";
        else if (h >= 11 && h < 15) greet = "Good Afternoon";
        else if (h >= 15 && h < 19) greet = "Good Evening";
        else greet = "Good Night";

        // Render Judul (Nama User)
        titleEl.innerText = `${greet}, ${displayName}`;
        titleEl.classList.add('personalized-title');

        // Logika Status Shift (Dot System)
        const today = new Date();
        let todayIdx = today.getDay() - 1;
        if (todayIdx === -1) todayIdx = 6;
        const activeShifts = getActiveShiftData();
        const code = activeShifts[myId][todayIdx];
        
        let statusLabel = "";
        let dotClass = "";
        
        if (code === 1) { statusLabel = "Morning Shift"; dotClass = "bg-p"; }
        else if (code === 2) { statusLabel = "Afternoon Shift"; dotClass = "bg-s"; }
        else if (code === 3) { statusLabel = "Night Shift"; dotClass = "bg-m"; }
        else if (code === 0) { statusLabel = "Off Duty"; dotClass = "bg-o"; }
        else if (code === 4) { statusLabel = "Vacation Leave"; dotClass = "bg-vl"; }
        else if (code === 5) { statusLabel = "On Leave (LOA)"; dotClass = "bg-loa"; }
        else if (code === 6) { statusLabel = "Happy Birthday"; dotClass = "bg-vl"; } // Special Label
        else { statusLabel = "Check Schedule"; dotClass = "bg-gray"; }

        // ============================================
        // INI BAGIAN "STEP B" (LOGIKA KONFETI)
        // ============================================
        // Cek Kode Shift: 0 (OFF), 4 (VL), 5 (LOA), 6 (BL)
        if (code === 0 || code === 4 || code === 5 || code === 6) {
             // Beri jeda sedikit agar halaman loading sempurna dulu baru meledak
             setTimeout(() => {
                 // Pastikan fungsi triggerCelebration sudah dibuat di Langkah A
                 if(typeof triggerCelebration === "function") {
                    triggerCelebration();
                 }
             }, 800);
        }
        // ============================================

        // Render Subtitle dengan Dot
        subEl.innerHTML = `<span class="status-dot ${dotClass}"></span> ${statusLabel}`;
        subEl.className = "shift-status-minimal"; 
        if(dividerEl) dividerEl.style.display = "none";

    } else {
        // --- MODE 2: JUDUL APLIKASI (DEFAULT) ---
        
        titleEl.innerText = "Shift Manager Promotion"; 
        titleEl.classList.remove('personalized-title');
        
        subEl.innerText = "Daily Dashboard";
        subEl.className = ""; // Reset style pill/dot
        
        if(dividerEl) dividerEl.style.display = "inline";
    }
}


// --- FITUR AUTO-SCROLL KE NAMA SAYA ---
function scrollToMyRow() {
    const myId = localStorage.getItem('my_profile_id');
    
    // Jika belum pilih profil, stop.
    if (myId === null) return;

    // Cari elemen baris (TR) milik user
    const targetRow = document.getElementById(`row-${myId}`);
    
    if (targetRow) {
        // 1. Scroll perlahan ke elemen tersebut
        setTimeout(() => {
            targetRow.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' // Taruh di tengah layar
            });
            
            // 2. Tambahkan efek kedip (Flash)
            targetRow.classList.add('row-flash');
            
            // 3. Hapus kelas animasi setelah selesai biar bersih
            setTimeout(() => {
                targetRow.classList.remove('row-flash');
            }, 2000);
            
        }, 500); // Delay sedikit (0.5 detik) agar loading selesai dulu
    }
}

// --- AUTO REDIRECT KE JADWAL ---
function forceOpenScheduleTab() {
    const myId = localStorage.getItem('my_profile_id');
    
    // Hanya pindah jika user sudah login (punya profil)
    if (myId === null) return;

    // 1. Cari tombol navigasi "Shift"
    // (Kita cari tombol yang punya fungsi switchTab ke 'schedule')
    const shiftBtn = document.querySelector("button[onclick*='schedule']");
    
    if(shiftBtn) {
        // 2. Klik tombol tersebut secara otomatis
        shiftBtn.click(); 
        
        // 3. Setelah pindah tab, baru jalankan Scroll
        // Kita beri jeda sedikit agar transisi tab selesai dulu
        setTimeout(() => {
            scrollToMyRow();
        }, 300); 
    }
}
