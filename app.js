(function() {
    'use strict';

    // DOM Elements
    const elements = {
        currentBalance: document.getElementById('currentBalance'),
        feeBox: document.getElementById('feeBox'),
        transactionAmount: document.getElementById('transactionAmount'),
        result: document.getElementById('result'),
        log: document.getElementById('log'),
        doneBtn: document.getElementById('doneButton'),
        clearBtn: document.getElementById('clearButton'),
        undoBtn: document.getElementById('undoButton'),
        redoBtn: document.getElementById('redoButton'),
        darkModeBtn: document.getElementById('darkModeButton'),
        timerInput: document.getElementById('timerInput'),
        startTimerBtn: document.getElementById('startTimerButton'),
        stopTimerBtn: document.getElementById('stopTimerButton'),
        refreshBtn: document.getElementById('refreshButton'),
        timerSection: document.getElementById('timerSection'),
        timerDisplay: document.getElementById('timerDisplay'),
        syncTimerDisplay: document.getElementById('syncTimerDisplay'),
        timerToggleBtn: document.getElementById('timerToggleButton'),
        profileSelect: document.getElementById('profileSelect'),
        deleteProfileBtn: document.getElementById('deleteProfileButton'),
        createProfileBtn: document.getElementById('createProfileButton'),
        addToBalanceBtn: document.getElementById('addToCurrentBalanceButton'),
        toggleProfilesBtn: document.getElementById('toggleProfilesButton'),
        profilesContainer: document.querySelector('.profiles-container'),
        profilesList: document.getElementById('profilesList'),
        selectAllBtn: document.getElementById('selectAllButton'),
        copyProfilesBtn: document.getElementById('copyProfilesButton'),
        profileFilter: document.getElementById('profileFilter'),
        balanceTypeBtn: document.getElementById('balanceTypeButton'),
        togglePosBtn: document.getElementById('togglePos'),
        syncTimer: document.getElementById('syncTimer'),
        togglePositionBtn: document.getElementById('togglePositionButton'),
        updateCheckedBtn: document.getElementById('updateCheckedButton'),
        copyToggleBtn: document.getElementById('copyToggleButton'),
        profilesHeading: document.getElementById('profilesHeading'),
        lastTopUpDisplay: document.getElementById('lastTopUpAmount'),
        mainWrapper: document.querySelector('.main-wrapper')
    };

    // Application State
    let state = {
        profiles: [],
        currentProfileIndex: null,
        history: [],
        redoHistory: [],
        lastTopUpAmount: 0,
        isTimerRunning: false,
        timerInterval: null,
        balanceType: 'First',
        autoCopyEnabled: false,
        profilesVisible: false,
        profilesOnRight: true,
        isCleared: false,
        backupData: null,
        copyMessageTimeout: null,
        draggedItem: null,
        draggedIndex: null
    };

    // --- Utilities ---

    function formatNumber(num) {
        if (num === null || num === undefined) return '';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function parseNumber(str) {
        if (!str) return 0;
        return parseFloat(str.toString().replace(/,/g, '')) || 0;
    }

    function showCopyMessage(message) {
        if (state.copyMessageTimeout) clearTimeout(state.copyMessageTimeout);

        let msgEl = document.getElementById('copy-message');
        if (!msgEl) {
            msgEl = document.createElement('div');
            msgEl.id = 'copy-message';
            document.body.appendChild(msgEl);
        }

        msgEl.textContent = message;
        msgEl.style.display = 'block';

        state.copyMessageTimeout = setTimeout(() => {
            msgEl.style.display = 'none';
        }, 2000);
    }

    // --- Core Logic ---

    function saveCurrentState() {
        return {
            currentBalance: elements.currentBalance.value,
            fee: elements.feeBox.value,
            transactionAmount: elements.transactionAmount.value,
            result: elements.result.value,
            logEntries: elements.log.innerHTML
        };
    }

    function saveProfileState() {
        if (state.currentProfileIndex !== null && state.profiles[state.currentProfileIndex]) {
            const profile = state.profiles[state.currentProfileIndex];
            profile.balance = parseNumber(elements.currentBalance.value);
            profile.fee = parseNumber(elements.feeBox.value);
            profile.transactionAmount = parseNumber(elements.transactionAmount.value);
            profile.history = [...state.history];
            profile.redoHistory = [...state.redoHistory];
            profile.logEntries = elements.log.innerHTML;
            profile.lastTopUpAmount = state.lastTopUpAmount;
        }
    }

    function updateUI() {
        updateProfileSelect();
        updateProfilesList();
        updateLastTopUpDisplay();
    }

    function updateProfileSelect() {
        elements.profileSelect.innerHTML = '';
        if (state.profiles.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Current Balance';
            elements.profileSelect.appendChild(opt);
        } else {
            state.profiles.forEach((profile, index) => {
                const opt = document.createElement('option');
                opt.value = index;
                opt.textContent = profile.name;
                elements.profileSelect.appendChild(opt);
            });
            if (state.currentProfileIndex !== null) {
                elements.profileSelect.value = state.currentProfileIndex;
            }
        }
    }

    function updateProfilesList() {
        elements.profilesList.innerHTML = '';
        if (state.profiles.length === 0) {
            elements.profilesList.innerHTML = '<p>No profiles created yet</p>';
            return;
        }

        state.profiles.forEach((profile, index) => {
            const item = document.createElement('div');
            item.className = 'profile-item';
            item.setAttribute('draggable', 'true');
            item.setAttribute('data-index', index);
            if (index === state.currentProfileIndex) item.classList.add('selected-profile');

            item.innerHTML = `
                <input type="checkbox" class="profile-checkbox" data-index="${index}">
                <div class="profile-info">
                    <span class="profile-name">${profile.name}</span>
                    <span class="profile-balance">${formatNumber(profile.balance)}</span>
                </div>
            `;
            elements.profilesList.appendChild(item);
        });
    }

    function updateLastTopUpDisplay() {
        if (state.lastTopUpAmount > 0) {
            elements.lastTopUpDisplay.textContent = formatNumber(state.lastTopUpAmount);
            elements.lastTopUpDisplay.style.display = 'inline-block';
        } else {
            elements.lastTopUpDisplay.style.display = 'none';
        }
    }

    // --- Actions ---

    function switchProfile(index) {
        if (index === '') return;
        saveProfileState();
        state.currentProfileIndex = parseInt(index);
        const profile = state.profiles[state.currentProfileIndex];

        elements.currentBalance.value = profile.balance ? formatNumber(profile.balance) : '';
        elements.feeBox.value = profile.fee ? formatNumber(profile.fee) : '';
        elements.transactionAmount.value = profile.transactionAmount ? formatNumber(profile.transactionAmount) : '';
        elements.result.value = '';
        elements.log.innerHTML = profile.logEntries || '';

        state.history = [...(profile.history || [])];
        state.redoHistory = [...(profile.redoHistory || [])];
        state.lastTopUpAmount = profile.lastTopUpAmount || 0;

        if (state.autoCopyEnabled) {
            extractAndCopySegment(profile.name);
        }

        updateUI();
        saveAllData();
    }

    async function extractAndCopySegment(name) {
        const segments = name.split(/[\s\-_]/).filter(s => s.length >= 15);
        if (segments.length > 0) {
            const target = segments[0].substring(0, 15);
            try {
                await navigator.clipboard.writeText(target);
                showCopyMessage(`Copied: ${target}`);
            } catch (e) {
                console.error("Failed to copy:", e);
            }
        }
    }

    // --- Event Handlers ---

    function init() {
        loadAllData();
        setupEventListeners();
        setupDragAndDrop();
    }

    function setupEventListeners() {
        // Formatting
        [elements.currentBalance, elements.feeBox, elements.transactionAmount].forEach(el => {
            el.addEventListener('input', () => {
                let val = el.value.replace(/,/g, '');
                if (!isNaN(val) && val !== '') {
                    el.value = formatNumber(parseFloat(val));
                }
                saveAllData();
            });
        });

        // Basic actions
        elements.doneBtn.addEventListener('click', handleDone);
        elements.addToBalanceBtn.addEventListener('click', handleTopUp);
        elements.clearBtn.addEventListener('click', handleClearRestore);
        elements.undoBtn.addEventListener('click', handleUndo);
        elements.redoBtn.addEventListener('click', handleRedo);

        // Timer
        elements.timerToggleBtn.addEventListener('click', () => {
            elements.timerSection.classList.toggle('active');
            elements.timerToggleBtn.classList.toggle('active');
            if (elements.timerSection.classList.contains('active')) elements.timerInput.focus();
            saveAllData();
        });

        elements.timerInput.addEventListener('input', updateTimerPreview);
        elements.startTimerBtn.addEventListener('click', startTimerAction);
        elements.refreshBtn.addEventListener('click', startTimerAction);
        elements.stopTimerBtn.addEventListener('click', stopTimerAction);
        elements.togglePosBtn.addEventListener('click', () => {
            elements.syncTimer.style.display = elements.syncTimer.style.display === 'none' ? 'block' : 'none';
        });

        // Profiles
        elements.createProfileBtn.addEventListener('click', createProfile);
        elements.deleteProfileBtn.addEventListener('click', deleteProfile);
        elements.profileSelect.addEventListener('change', (e) => switchProfile(e.target.value));
        elements.toggleProfilesBtn.addEventListener('click', toggleProfilesVisibility);
        elements.togglePositionBtn.addEventListener('click', toggleProfilesPosition);
        elements.copyToggleBtn.addEventListener('click', toggleAutoCopy);
        elements.selectAllBtn.addEventListener('click', selectAllProfiles);
        elements.updateCheckedBtn.addEventListener('click', updateCheckedProfiles);
        elements.copyProfilesBtn.addEventListener('click', copyProfilesToClipboard);
        elements.balanceTypeBtn.addEventListener('click', toggleBalanceType);

        elements.profileFilter.addEventListener('input', function() {
            const boId = this.value.trim();
            elements.profilesHeading.innerHTML = boId ? `Profiles <span class="bo-id">(${boId})</span>` : 'All Profiles';
        });

        // Profile list delegation
        elements.profilesList.addEventListener('click', (e) => {
            if (e.target.classList.contains('profile-checkbox')) return;
            const item = e.target.closest('.profile-item');
            if (item) {
                const index = item.getAttribute('data-index');
                elements.profileSelect.value = index;
                switchProfile(index);
            }
        });

        // Theme
        elements.darkModeBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            elements.darkModeBtn.textContent = document.body.classList.contains('dark-mode') ? '☾' : '☀︎';
            saveAllData();
        });
    }

    async function handleDone() {
        try {
            const clipText = await navigator.clipboard.readText();
            const transAmt = parseNumber(clipText);
            const balance = parseNumber(elements.currentBalance.value);
            const fee = parseNumber(elements.feeBox.value);
            const result = balance - fee - transAmt;
            const formatted = formatNumber(result);

            await navigator.clipboard.writeText(formatted);

            const now = new Date();
            const timeStr = now.toTimeString().split(' ')[0];
            const logMsg = fee === 0 ?
                `${formatNumber(balance)} - ${formatNumber(transAmt)} = ${formatted}` :
                `${formatNumber(balance)} - ${formatNumber(fee)} - ${formatNumber(transAmt)} = ${formatted}`;

            state.history.push(saveCurrentState());
            state.redoHistory = [];

            elements.log.innerHTML = `<div class="log-entry"><span>${logMsg} [${timeStr}]</span></div>${elements.log.innerHTML}`;
            elements.currentBalance.value = formatted;
            elements.transactionAmount.value = '';
            elements.result.value = `${logMsg.split('=')[0].trim()} = ${formatted}`;

            saveProfileState();
            updateUI();
            saveAllData();
            showCopyMessage("Result copied to clipboard");
        } catch (e) {
            alert("Failed to handle transaction: " + e.message);
        }
    }

    async function handleTopUp() {
        try {
            const clipText = await navigator.clipboard.readText();
            const topUp = parseNumber(clipText);
            const balance = parseNumber(elements.currentBalance.value);
            const newVal = balance + topUp;

            state.history.push(saveCurrentState());
            state.redoHistory = [];
            state.lastTopUpAmount = topUp;

            const now = new Date();
            const timeStr = now.toTimeString().split(' ')[0];
            const logMsg = `<span class="green-text">${formatNumber(balance)} + ${formatNumber(topUp)} = ${formatNumber(newVal)} [${timeStr}]</span>`;

            elements.log.innerHTML = `<div class="log-entry">${logMsg}</div>${elements.log.innerHTML}`;
            elements.currentBalance.value = formatNumber(newVal);
            elements.result.value = `${formatNumber(balance)} + ${formatNumber(topUp)} = ${formatNumber(newVal)}`;

            saveProfileState();
            updateUI();
            saveAllData();
            showCopyMessage("Balance updated");
        } catch (e) {
            alert("Failed to top up: " + e.message);
        }
    }

    function handleClearRestore() {
        if (!state.isCleared) {
            state.backupData = {
                currentBalance: elements.currentBalance.value,
                fee: elements.feeBox.value,
                transactionAmount: elements.transactionAmount.value,
                result: elements.result.value,
                logEntries: elements.log.innerHTML,
                history: [...state.history],
                redoHistory: [...state.redoHistory],
                profiles: JSON.parse(JSON.stringify(state.profiles)),
                currentProfileIndex: state.currentProfileIndex,
                lastTopUpAmount: state.lastTopUpAmount
            };

            elements.currentBalance.value = '';
            elements.feeBox.value = '';
            elements.transactionAmount.value = '';
            elements.result.value = '';
            elements.log.innerHTML = '';
            state.history = [];
            state.redoHistory = [];
            state.profiles = [];
            state.currentProfileIndex = null;
            state.lastTopUpAmount = 0;

            elements.clearBtn.textContent = 'Restore';
            state.isCleared = true;
            showCopyMessage("All data cleared - click again to restore");
        } else {
            if (state.backupData) {
                const b = state.backupData;
                elements.currentBalance.value = b.currentBalance;
                elements.feeBox.value = b.fee;
                elements.transactionAmount.value = b.transactionAmount;
                elements.result.value = b.result;
                elements.log.innerHTML = b.logEntries;
                state.history = b.history;
                state.redoHistory = b.redoHistory;
                state.profiles = b.profiles;
                state.currentProfileIndex = b.currentProfileIndex;
                state.lastTopUpAmount = b.lastTopUpAmount;
            }
            elements.clearBtn.textContent = 'Clear';
            state.isCleared = false;
            showCopyMessage("All data restored");
        }
        updateUI();
        saveAllData();
    }

    function handleUndo() {
        if (state.history.length > 0) {
            state.redoHistory.push(saveCurrentState());
            const last = state.history.pop();
            elements.currentBalance.value = last.currentBalance;
            elements.feeBox.value = last.fee;
            elements.transactionAmount.value = last.transactionAmount;
            elements.result.value = last.result;
            elements.log.innerHTML = last.logEntries;
            saveProfileState();
            updateUI();
            saveAllData();
        }
    }

    function handleRedo() {
        if (state.redoHistory.length > 0) {
            state.history.push(saveCurrentState());
            const next = state.redoHistory.pop();
            elements.currentBalance.value = next.currentBalance;
            elements.feeBox.value = next.fee;
            elements.transactionAmount.value = next.transactionAmount;
            elements.result.value = next.result;
            elements.log.innerHTML = next.logEntries;
            saveProfileState();
            updateUI();
            saveAllData();
        }
    }

    // --- Timer ---

    function updateTimerPreview() {
        const mins = parseInt(elements.timerInput.value);
        if (!isNaN(mins) && mins > 0) {
            const str = `${mins.toString().padStart(2, '0')}:00`;
            elements.timerDisplay.textContent = str;
            elements.syncTimerDisplay.textContent = str;
            elements.syncTimerDisplay.style.display = 'block';
            elements.refreshBtn.style.display = 'inline-block';
            elements.togglePosBtn.style.display = 'inline-block';
        } else {
            elements.timerDisplay.textContent = "00:00";
            elements.syncTimerDisplay.style.display = 'none';
            elements.refreshBtn.style.display = 'none';
            elements.togglePosBtn.style.display = 'none';
        }
    }

    function startTimerAction() {
        const mins = parseInt(elements.timerInput.value);
        if (isNaN(mins) || mins <= 0) return alert("Please enter valid minutes.");

        if (state.timerInterval) clearInterval(state.timerInterval);
        state.isTimerRunning = true;
        let time = mins * 60;

        const update = () => {
            const m = Math.floor(time / 60).toString().padStart(2, '0');
            const s = (time % 60).toString().padStart(2, '0');
            const str = `${m}:${s}`;
            elements.timerDisplay.textContent = str;
            elements.syncTimerDisplay.textContent = str;
            if (time <= 0) {
                clearInterval(state.timerInterval);
                state.isTimerRunning = false;
            }
            time--;
        };
        update();
        state.timerInterval = setInterval(update, 1000);
    }

    function stopTimerAction() {
        if (state.timerInterval) clearInterval(state.timerInterval);
        state.isTimerRunning = false;
        elements.timerInput.value = '';
        elements.timerDisplay.textContent = "00:00";
        elements.syncTimerDisplay.style.display = 'none';
        elements.refreshBtn.style.display = 'none';
        elements.togglePosBtn.style.display = 'none';
    }

    // --- Profiles ---

    function createProfile() {
        const name = prompt("Enter profile name:");
        if (name && name.trim()) {
            const profile = {
                name: name.trim(),
                balance: 0,
                fee: 0,
                transactionAmount: 0,
                history: [],
                redoHistory: [],
                logEntries: '',
                lastTopUpAmount: 0
            };
            state.profiles.push(profile);
            state.currentProfileIndex = state.profiles.length - 1;
            updateUI();
            switchProfile(state.currentProfileIndex);
        }
    }

    function deleteProfile() {
        if (state.currentProfileIndex === null) return alert("Select a profile to delete.");
        if (confirm("Are you sure you want to delete this profile?")) {
            state.profiles.splice(state.currentProfileIndex, 1);
            state.currentProfileIndex = state.profiles.length > 0 ? 0 : null;
            if (state.currentProfileIndex !== null) {
                switchProfile(0);
            } else {
                elements.currentBalance.value = '';
                elements.feeBox.value = '';
                elements.transactionAmount.value = '';
                elements.result.value = '';
                elements.log.innerHTML = '';
                state.history = [];
                state.redoHistory = [];
                state.lastTopUpAmount = 0;
                updateUI();
            }
            saveAllData();
        }
    }

    function toggleProfilesVisibility() {
        state.profilesVisible = !state.profilesVisible;
        elements.profilesContainer.style.display = state.profilesVisible ? 'block' : 'none';
        elements.toggleProfilesBtn.textContent = state.profilesVisible ? '👥' : '👤';
    }

    function toggleProfilesPosition() {
        state.profilesOnRight = !state.profilesOnRight;
        elements.mainWrapper.classList.toggle('profiles-left', !state.profilesOnRight);
        localStorage.setItem('profilesPosition', state.profilesOnRight ? 'right' : 'left');
    }

    function toggleAutoCopy() {
        state.autoCopyEnabled = !state.autoCopyEnabled;
        elements.copyToggleBtn.textContent = state.autoCopyEnabled ? '☻' : '☺';
        localStorage.setItem('autoCopyEnabled', state.autoCopyEnabled);
    }

    function toggleBalanceType() {
        state.balanceType = state.balanceType === 'First' ? 'Last' : 'First';
        elements.balanceTypeBtn.textContent = state.balanceType;
        elements.balanceTypeBtn.classList.toggle('last-state', state.balanceType === 'Last');
        localStorage.setItem('balanceType', state.balanceType);
    }

    function selectAllProfiles() {
        const checks = elements.profilesList.querySelectorAll('.profile-checkbox');
        const allChecked = Array.from(checks).every(c => c.checked);
        checks.forEach(c => c.checked = !allChecked);
    }

    function updateCheckedProfiles() {
        const checked = elements.profilesList.querySelectorAll('.profile-checkbox:checked');
        if (checked.length === 0) return alert("Please select profiles to update.");

        const balance = parseNumber(elements.currentBalance.value);
        checked.forEach(c => {
            const idx = parseInt(c.getAttribute('data-index'));
            state.profiles[idx].balance = balance;
        });

        updateProfilesList();
        saveAllData();
        showCopyMessage(`Updated ${checked.length} profile(s)`);
    }

    async function copyProfilesToClipboard() {
        const selected = Array.from(elements.profilesList.querySelectorAll('.profile-checkbox:checked'))
            .map(c => state.profiles[parseInt(c.getAttribute('data-index'))]);

        if (selected.length === 0) return alert("Please select profiles to copy.");

        const filter = elements.profileFilter.value.trim();
        const type = state.balanceType;
        let text = '';

        selected.forEach(p => {
            if (filter) {
                const cleanName = p.name.replace(/BO\d+\s*-?\s*/i, '').trim();
                text += `${filter} - ${cleanName} - ${type} : ${formatNumber(p.balance)} VND\n`;
            } else {
                const match = p.name.match(/(BO\d+)(?:\s*-\s*)?(.+)?/i);
                if (match) {
                    const id = match[1];
                    const name = match[2] || p.name.replace(id, '').replace(/^\s*-\s*/, '').trim();
                    text += `${id} - ${name} - ${type} : ${formatNumber(p.balance)} VND\n`;
                } else {
                    text += `${p.name} - ${type} : ${formatNumber(p.balance)} VND\n`;
                }
            }
        });

        try {
            await navigator.clipboard.writeText(text.trim());
            showCopyMessage(`Copied ${selected.length} profile(s)`);
        } catch (e) {
            showCopyMessage("Failed to copy");
        }
    }

    // --- Persistence ---

    function saveAllData() {
        saveProfileState();
        const data = {
            profiles: state.profiles,
            currentProfileIndex: state.currentProfileIndex,
            darkMode: document.body.classList.contains('dark-mode'),
            timerInput: elements.timerInput.value,
            lastTopUpAmount: state.lastTopUpAmount
        };
        localStorage.setItem('r2000Data', JSON.stringify(data));
    }

    function loadAllData() {
        const saved = localStorage.getItem('r2000Data');
        if (saved) {
            const data = JSON.parse(saved);
            state.profiles = data.profiles || [];
            state.currentProfileIndex = data.currentProfileIndex;
            state.lastTopUpAmount = data.lastTopUpAmount || 0;

            if (data.darkMode) {
                document.body.classList.add('dark-mode');
                elements.darkModeBtn.textContent = '☾';
            }

            elements.timerInput.value = data.timerInput || '';
            updateTimerPreview();

            if (state.currentProfileIndex !== null && state.profiles[state.currentProfileIndex]) {
                const p = state.profiles[state.currentProfileIndex];
                elements.currentBalance.value = formatNumber(p.balance);
                elements.feeBox.value = p.fee ? formatNumber(p.fee) : '';
                elements.transactionAmount.value = p.transactionAmount ? formatNumber(p.transactionAmount) : '';
                elements.log.innerHTML = p.logEntries || '';
                state.history = [...(p.history || [])];
                state.redoHistory = [...(p.redoHistory || [])];
            }
        }

        state.autoCopyEnabled = localStorage.getItem('autoCopyEnabled') === 'true';
        elements.copyToggleBtn.textContent = state.autoCopyEnabled ? '☻' : '☺';

        state.profilesOnRight = localStorage.getItem('profilesPosition') !== 'left';
        elements.mainWrapper.classList.toggle('profiles-left', !state.profilesOnRight);

        state.balanceType = localStorage.getItem('balanceType') || 'First';
        elements.balanceTypeBtn.textContent = state.balanceType;
        elements.balanceTypeBtn.classList.toggle('last-state', state.balanceType === 'Last');

        updateUI();
    }

    // --- Drag and Drop ---

    function setupDragAndDrop() {
        elements.profilesList.addEventListener('dragstart', (e) => {
            const item = e.target.closest('.profile-item');
            if (!item) return;
            state.draggedItem = item;
            state.draggedIndex = parseInt(item.getAttribute('data-index'));
            item.classList.add('dragging');
        });

        elements.profilesList.addEventListener('dragend', (e) => {
            const item = e.target.closest('.profile-item');
            if (item) item.classList.remove('dragging');
        });

        elements.profilesList.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterEl = getDragAfterElement(elements.profilesList, e.clientY);
            const currentItem = document.querySelector('.dragging');
            if (!currentItem) return;
            if (afterEl == null) {
                elements.profilesList.appendChild(currentItem);
            } else {
                elements.profilesList.insertBefore(currentItem, afterEl);
            }
        });

        elements.profilesList.addEventListener('drop', (e) => {
            e.preventDefault();
            if (state.draggedItem) {
                const newIndex = Array.from(elements.profilesList.children).indexOf(state.draggedItem);
                if (newIndex !== state.draggedIndex) {
                    const moved = state.profiles.splice(state.draggedIndex, 1)[0];
                    state.profiles.splice(newIndex, 0, moved);

                    if (state.currentProfileIndex === state.draggedIndex) {
                        state.currentProfileIndex = newIndex;
                    } else if (state.currentProfileIndex > state.draggedIndex && state.currentProfileIndex <= newIndex) {
                        state.currentProfileIndex--;
                    } else if (state.currentProfileIndex < state.draggedIndex && state.currentProfileIndex >= newIndex) {
                        state.currentProfileIndex++;
                    }

                    updateProfileSelect();
                    saveAllData();
                }
            }
        });
    }

    function getDragAfterElement(container, y) {
        const draggables = [...container.querySelectorAll('.profile-item:not(.dragging)')];
        return draggables.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // --- Initialization ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
