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
let masterData = [];

// Data Jadwal
let shiftDataCurrent = []; // Minggu Ini
let shiftDataNext = [];    // Minggu Depan
let bulletinMessage = "No new announcements."; // Bulletin Board
let lastUpdateTime = "-";

let currentViewMode = 'current'; // 'current' atau 'next'

let selectedFilterLetter = 'ALL';

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
    
    // Update Menu Text & Icon (Phosphor Icons)
    if(authText && authIcon) {
        if(isAdmin) {
            authText.innerText = "Logout Admin";
            authIcon.classList.remove('ph-lock-key');
            authIcon.classList.add('ph-lock-key-open'); // Icon Terbuka
        } else {
            authText.innerText = "Admin Access";
            authIcon.classList.remove('ph-lock-key-open');
            authIcon.classList.add('ph-lock-key'); // Icon Terkunci
        }
    }

    // Fitur Khusus Admin (Tampilkan/Sembunyikan)
    const elementsToToggle = [
        'btnRollOver',      
        'nav-import',       
        'nav-swap',         
        'btnAddAgent',      
        'btnResetShifts',   
        'btnEditBulletin'   
    ];

    elementsToToggle.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            // Import/Swap pakai 'flex', sisanya 'block' atau 'inline-flex'
            const displayType = (id === 'nav-import' || id === 'nav-swap' || id === 'btnAddAgent') ? 'flex' : 'block';
            el.style.display = isAdmin ? displayType : 'none';
        }
    });
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
    toggleMenu(); // Tutup menu
    if(isAdmin) {
        doLogout();
    } else {
        showLoginModal();
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

function doLogout() {
    localStorage.removeItem(AUTH_KEY);
    isAdmin = false;
    location.reload(); 
}

function checkPermission() {
    if(!isAdmin) {
        alert("🔒 Access Denied! Please Login as Admin.");
        return false;
    }
    return true;
}

// ==========================================================
// 4. DATA HANDLING (LOAD & SAVE)
// ==========================================================

async function initData() {
    checkAuth(); 
    initTheme(); 

    // Handle Loading UI
    const loadingLayer = document.getElementById("loadingLayer");
    
    try {
        const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
            method: 'GET',
            headers: { 'X-Master-Key': API_KEY }
        });
        
        if(!res.ok) throw new Error("Connection failed");
        
        const json = await res.json();
        const data = json.record; 

        masterData = data.master || [];
        shiftDataCurrent = data.shifts || []; 
        shiftDataNext = data.shiftsNext || Array(masterData.length).fill().map(() => Array(7).fill(0));
        bulletinMessage = data.bulletin || "No new announcements.";
        lastUpdateTime = data.lastUpdate || "-";
        
        updateTimeBadge();

        // Sinkronisasi jika agent bertambah
        if(shiftDataNext.length < masterData.length) {
             const diff = masterData.length - shiftDataNext.length;
             for(let i=0; i<diff; i++) shiftDataNext.push([0,0,0,0,0,0,0]);
        }

        renderBulletin(); 

        // Hide Loading Layer Properly
        if(loadingLayer) loadingLayer.style.display = 'none';
        
    } catch (error) {
        console.error(error);
        alert("Failed to load data! Using dummy/offline mode.");
        if(loadingLayer) loadingLayer.style.display = 'none';
        
        // Dummy Data Fallback
        masterData = [{spv:"System", name:"Error Load", role:"Agent"}];
        shiftDataCurrent = [[0,0,0,0,0,0,0]];
        shiftDataNext = [[0,0,0,0,0,0,0]];
    }
    
    populateProfileSelector();
    highlightMyRow(); 
    
    renderAlphabetBar();
    
    refreshAllViews();
    
    setTimeout(() => {
        const loader = document.getElementById('preloader');
        if(loader) {
            loader.classList.add('preloader-hidden');
            
            // Hapus elemen dari DOM agar tidak menghalangi klik (opsional)
            setTimeout(() => { loader.style.display = 'none'; }, 500);
        }
    }, 800); // Delay 0.8 detik agar user sempat melihat GIF-nya (efek estetik)
    
    }


async function saveAll() {
    if(!isAdmin) return;

    showToast("Saving...", "process");

    // --- BUAT WAKTU SEKARANG ---
    const now = new Date();
    const timeString = now.toLocaleDateString('en-GB', { 
        weekday: 'short', day: 'numeric', month: 'short' 
    }) + " • " + now.toLocaleTimeString('en-GB', { 
        hour: '2-digit', minute: '2-digit', hour12: false 
    });

    const payload = { 
        master: masterData, 
        shifts: shiftDataCurrent,
        shiftsNext: shiftDataNext,
        bulletin: bulletinMessage,
        lastUpdate: timeString 
    }

    try {
        const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': API_KEY
            },
            body: JSON.stringify(payload)
        });

        if(!res.ok) throw new Error("Save failed");

        lastUpdateTime = timeString;
        updateTimeBadge();
        showToast("Data Saved Successfully!", "success");

    } catch (error) {
        console.error(error);
        alert("Failed to save data!");
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

function editBulletin() {
    if(!checkPermission()) return;
    const newText = prompt("Update Announcement:", bulletinMessage);
    if(newText !== null) { 
        bulletinMessage = newText;
        renderBulletin();
        saveAll(); 
    }
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
    if(!confirm("⚠️ Overwrite THIS WEEK with NEXT WEEK data?")) return;

    shiftDataCurrent = JSON.parse(JSON.stringify(shiftDataNext));
    shiftDataNext = Array(masterData.length).fill().map(() => Array(7).fill(0));

    currentViewMode = 'current';
    document.getElementById('weekSelector').value = 'current';

    saveAll();
    refreshAllViews();
    showToast("Roll Over Successful!", "success");
}

// ==========================================================
// 6. UI UTAMA (DASHBOARD, TABLE, DLL)
// ==========================================================

function refreshAllViews() {
    renderTables(); 
    renderGrouping(); 
    populateSwapDropdowns(); 
    renderAgentList();
    
    /* renderDailyNarrative(); */
}

function switchTab(tabName, btnElement) {
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    btnElement.classList.add('active');
}

// ==========================================================
// FUNGSI RENDER TABLES (MODERN LAYOUT)
// ==========================================================

function renderTables() {
    const container = document.getElementById("mainContainer");
    container.innerHTML = ""; 
    const supervisors = ["Hijryan", "Silvia", "Farikha", "Support"];
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    // Cari hari ini untuk highlight
    const jsDay = new Date().getDay(); 
    let todayColIdx = jsDay - 1; 
    if (todayColIdx === -1) todayColIdx = 6; 

    // Judul Mode (Jika Next Week aktif)
    if (currentViewMode === 'next') {
        const warning = document.createElement("div");
        warning.style.padding = "10px";
        warning.style.textAlign = "center";
        warning.style.background = "#fff7ed";
        warning.style.color = "#ea580c";
        warning.style.fontSize = "12px";
        warning.style.fontWeight = "bold";
        warning.style.borderBottom = "1px solid #fed7aa";
        warning.innerHTML = "<i class='ph ph-warning'></i> You are viewing NEXT WEEK (Initial)";
        container.appendChild(warning);
    }
    
    const activeShifts = getActiveShiftData();

    supervisors.forEach(spvName => {
        const section = document.createElement("div");
        section.className = "team-section";
        section.dataset.team = spvName; 
        
        section.innerHTML = `<div class="team-header">TEAM ${spvName.toUpperCase()}</div>`;
        
        // --- HEADER TABEL ---
        let tableHtml = `<table><thead><tr><th>Name</th>`;
        days.forEach((d, i) => {
            const isToday = (i === todayColIdx) ? 'class="today-col"' : '';
            tableHtml += `<th ${isToday}>${d}</th>`;
        });
        tableHtml += `</tr></thead><tbody>`;

        masterData.forEach((agent, globalIndex) => {
            if(agent.spv === spvName) {
                
                // Highlight Baris Saya
                const myId = localStorage.getItem('my_profile_id');
                const isMe = (myId == globalIndex) ? "class='my-row'" : ""; 

                tableHtml += `<tr ${isMe} id="row-${globalIndex}" onclick="toggleRowHighlight(${globalIndex})">
                    <td>${agent.name}</td>`;
                
                // Isi Shift
                for(let d=0; d<7; d++) {
                    const val = activeShifts[globalIndex][d];
                    const type = shiftTypes[val] || shiftTypes[0]; 
                    const isTodayCell = (d === todayColIdx) ? 'today-col' : '';

                    tableHtml += `<td class="${isTodayCell}">
                        <button class="cell-btn ${type.class}" onclick="cycleShift(${globalIndex}, ${d})">${type.code}</button>
                    </td>`;
                }
                tableHtml += `</tr>`;
            }
        });
        tableHtml += `</tbody></table>`;
        section.appendChild(document.createElement("div")).innerHTML = tableHtml;
        container.appendChild(section);
    });
    
    filterTables(); 
    renderInteractiveLegend();
}


function filterTables() {
    const selected = document.getElementById("teamFilter").value;
    document.querySelectorAll(".team-section").forEach(sec => {
        sec.style.display = (selected === "ALL" || sec.dataset.team === selected) ? "block" : "none";
    });
}

function cycleShift(idx, dayIdx) {
    if(!checkPermission()) return; 
    let targetArray = getActiveShiftData();
    let val = targetArray[idx][dayIdx];
    val++; 
    if (val > 6) val = 0; 
    targetArray[idx][dayIdx] = val;
    setActiveShiftData(targetArray);
    
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
    if(!checkPermission()) return; 
    const i1 = document.getElementById("swapAgent1").value;
    const i2 = document.getElementById("swapAgent2").value;
    
    // Ambil checkbox yang dicentang
    const days = [];
    document.querySelectorAll('.swap-day:checked').forEach(cb => days.push(cb.value));

    if(i1 === "" || i2 === "" || i1 === i2 || days.length === 0) {
        return alert("Invalid swap configuration!");
    }
    
    let targetArray = getActiveShiftData();
    days.forEach(d => {
        const temp = targetArray[i1][d];
        targetArray[i1][d] = targetArray[i2][d];
        targetArray[i2][d] = temp;
    });
    
    setActiveShiftData(targetArray);
    saveAll(); refreshAllViews(); 
    showToast("Swap Successful!", "success");
    
    // Reset Checkbox
    document.querySelectorAll('.swap-day').forEach(cb => cb.checked = false);
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

    // --- STEP 1: FILTER BERDASARKAN HURUF ---
    let filteredData = masterData.map((agent, index) => ({ ...agent, originalIndex: index }));
    
    if (selectedFilterLetter !== 'ALL') {
        filteredData = filteredData.filter(agent => 
            agent.name.toUpperCase().startsWith(selectedFilterLetter)
        );
    }
    
    // Update Badge Total sesuai filter
    if(totalBadge) totalBadge.innerText = `Total: ${filteredData.length}`;

    // Jika kosong
    if(filteredData.length === 0) {
        list.innerHTML = `<div style="padding:20px; text-align:center; color:#94a3b8; font-size:13px;">
            No agent found starting with "${selectedFilterLetter}"
        </div>`;
        return;
    }

    // --- STEP 2: SORTING ABJAD (A-Z) ---
    filteredData.sort((a, b) => a.name.localeCompare(b.name));

    // --- STEP 3: RENDER ---
    filteredData.forEach((a) => {
        const i = a.originalIndex; // PENTING: Pakai index asli untuk Edit/Delete
        const role = a.role || "Agent"; 
        
        let roleBadgeHTML = "";
        if(role === "TL") roleBadgeHTML = `<span class="mini-badge" style="background:#fff7ed; color:#c2410c; border:1px solid #fdba74;">TL</span>`;
        if(role === "SME") roleBadgeHTML = `<span class="mini-badge" style="background:#f3e8ff; color:#7e22ce; border:1px solid #d8b4fe;">SME</span>`;

        const initials = getInitials(a.name);
        const avatarColor = stringToColor(a.name);

        let actionButtons = "";
        if (isAdmin) {
            actionButtons = `<div style="display:flex; gap:8px;">
                <button class="icon-btn-sm" style="color:#f59e0b" onclick="openModal('edit',${i})"><i class="ph ph-pencil-simple"></i></button>
                <button class="icon-btn-sm" style="color:#ef4444" onclick="deleteAgent(${i})"><i class="ph ph-trash"></i></button>
            </div>`;
        }

        list.innerHTML += `
        <li class="agent-item">
            <div class="agent-avatar" style="background-color: ${avatarColor};">
                ${initials}
            </div>
            <div class="agent-info-wrapper">
                <span class="agent-name-text">
                    ${a.name} ${roleBadgeHTML}
                </span>
                <span class="agent-role-text">
                    ${a.spv} <span style="margin:0 4px">•</span> ${role}
                </span>
            </div>
            ${actionButtons}
        </li>`;
    });
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

function openModal(mode, idx) {
    if(!checkPermission()) return; 
    document.getElementById('agentModal').style.display = 'flex';
    document.getElementById('editIndex').value = mode === 'add' ? -1 : idx;
    
    if(mode !== 'add') {
        document.getElementById('modalTitle').innerText = "Edit Agent";
        document.getElementById('modalName').value = masterData[idx].name;
        document.getElementById('modalTeam').value = masterData[idx].spv;
        document.getElementById('modalRole').value = masterData[idx].role || "Agent"; 
    } else { 
        document.getElementById('modalTitle').innerText = "Add New Agent";
        document.getElementById('modalName').value = ""; 
        document.getElementById('modalRole').value = "Agent"; 
    }
}

function saveAgent() {
    if(!checkPermission()) return; 
    const name = document.getElementById('modalName').value;
    const spv = document.getElementById('modalTeam').value;
    const role = document.getElementById('modalRole').value; 
    const idx = document.getElementById('editIndex').value;

    if(!name) return alert("Name required!");

    if(idx == -1) { 
        masterData.push({ name, spv, role }); 
        shiftDataCurrent.push([0,0,0,0,0,0,0]); 
        shiftDataNext.push([0,0,0,0,0,0,0]); 
    } else { 
        masterData[idx].name = name; 
        masterData[idx].spv = spv; 
        masterData[idx].role = role; 
    }
    document.getElementById('agentModal').style.display='none';
    saveAll(); refreshAllViews();
}

function deleteAgent(idx) {
    if(!checkPermission()) return; 
    if(confirm("Are you sure you want to delete this agent?")) { 
        masterData.splice(idx,1); 
        shiftDataCurrent.splice(idx,1); 
        shiftDataNext.splice(idx,1); 
        saveAll(); refreshAllViews(); 
    }
}

function resetAll() { 
    if(!checkPermission()) return; 
    if(confirm("⚠️ RESET ALL SHIFTS for this week? This cannot be undone.")) { 
        if(currentViewMode === 'current') {
            shiftDataCurrent = shiftDataCurrent.map(()=>[0,0,0,0,0,0,0]);
        } else {
            shiftDataNext = shiftDataNext.map(()=>[0,0,0,0,0,0,0]);
        }
        saveAll(); refreshAllViews(); 
    } 
}

// ==========================================================
// 7. UTILITIES (IMPORT, EXPORT, REPORT)
// ==========================================================

function importRawJson() {
    if(!checkPermission()) return; 
    const rawText = document.getElementById('jsonImportArea').value;
    if (!rawText.trim()) return alert("JSON Area Empty!");
    try {
        const parsedData = JSON.parse(rawText);
        if (Array.isArray(parsedData.master) && Array.isArray(parsedData.shifts)) {
            if(confirm("Overwrite Database with this JSON?")) {
                masterData = parsedData.master;
                shiftDataCurrent = parsedData.shifts;
                shiftDataNext = parsedData.shiftsNext || Array(masterData.length).fill().map(()=>Array(7).fill(0));
                bulletinMessage = parsedData.bulletin || "";
                saveAll(); refreshAllViews();
                showToast("Database Restored!", "success");
            }
        } else { alert("Invalid JSON Format!"); }
    } catch (e) { alert("Error Parsing JSON"); }
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

function downloadScheduleAsImage() {
    const elementToCapture = document.getElementById("mainContainer");
    if(!elementToCapture || elementToCapture.innerText.trim() === "") {
        return alert("Table is empty/not visible!");
    }

    showToast("Generating Image...", "process");

    html2canvas(elementToCapture, {
        scale: 2, 
        backgroundColor: document.body.getAttribute('data-theme') === 'dark' ? '#1e293b' : '#ffffff',
        useCORS: true
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'Schedule-' + new Date().getTime() + '.png';
        link.href = canvas.toDataURL("image/png");
        link.click();
        showToast("Image Downloaded!", "success");
    }).catch(err => {
        console.error(err);
        alert("Failed to generate image.");
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

// --- WHATSAPP REPORT ---
function copyScheduleText() {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const jsDay = new Date().getDay(); 
    const todayName = days[jsDay];
    let todayIdx = jsDay - 1; 
    if (todayIdx === -1) todayIdx = 6; 

    const activeShifts = getActiveShiftData();
    let groups = { "🌞 MORNING": [], "🌤 AFTERNOON": [], "🌙 NIGHT": [] };

    masterData.forEach((agent, idx) => {
        const val = activeShifts[idx][todayIdx];
        if (val === 0 || val === 4 || val === 5 || val === 6) return; // Skip OFF
        
        let dName = agent.name;
        if (agent.role === "TL") dName += " (TL)";
        else if (agent.role === "SME") dName += " (SME)";

        if (val === 1) groups["🌞 MORNING"].push(dName);
        else if (val === 2) groups["🌤 AFTERNOON"].push(dName);
        else if (val === 3) groups["🌙 NIGHT"].push(dName);
    });

    let report = `*SHIFT REPORT - ${todayName.toUpperCase()}*\n----------------------------------\n`;
    for (const [title, names] of Object.entries(groups)) {
        if (names.length > 0) {
            // Count Regular Agents Only (Exclude TL/SME from count)
            const regCount = names.filter(n => !n.includes("(TL)") && !n.includes("(SME)")).length;
            report += `*${title} (${regCount})*\n`;
            names.forEach(n => report += `▫️ ${n}\n`);
            report += `\n`;
        }
    }
    report += `----------------------------------\n_Generated by Shift Manager_`;

    navigator.clipboard.writeText(report);
    showToast("Report Copied to Whatsapp!", "success");
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

// START APP
initData();
