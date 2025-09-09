const dom = {
    apiKey: /** @type {HTMLInputElement} */ (document.getElementById('apiKey')),
    saveKeyBtn: /** @type {HTMLButtonElement} */ (document.getElementById('saveKeyBtn')),
    email: /** @type {HTMLInputElement} */ (document.getElementById('email')),
    password: /** @type {HTMLInputElement} */ (document.getElementById('password')),
    loginBtn: /** @type {HTMLButtonElement} */ (document.getElementById('loginBtn')),
    projectsBlock: /** @type {HTMLDivElement} */ (document.getElementById('projectsBlock')),
    workspaceSelect: /** @type {HTMLSelectElement} */ (document.getElementById('workspaceSelect')),
    projectSelect: /** @type {HTMLSelectElement} */ (document.getElementById('projectSelect')),
    saveProjectBtn: /** @type {HTMLButtonElement} */ (document.getElementById('saveProjectBtn')),
    status: /** @type {HTMLDivElement} */ (document.getElementById('status')),
    authState: /** @type {HTMLDivElement} */ (document.getElementById('authState')),
};

/**
 * Simple status renderer
 * @param {string} text
 * @param {"ok"|"err"|"info"} [kind]
 */
function setStatus(text, kind = 'info') {
    dom.status.textContent = text;
    dom.status.style.color = kind === 'err' ? '#dc2626' : kind === 'ok' ? '#16a34a' : 'inherit';
}

function loadFromStorage() {
    return browser.storage.local.get(['weeekApiKey', 'weeekWorkspaceId', 'weeekProjectId', 'weeekAuthEmail']);
}

function saveToStorage(data) {
    return browser.storage.local.set(data);
}

async function fetchJson(url, apiKey) {
    const resp = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
        },
    });
    if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
    }
    return resp.json();
}

async function getWorkspace(apiKey) {
    // Возвращает один workspace
    const res = await fetchJson('https://api.weeek.net/public/v1/ws', apiKey);
    return res && (res.workspace || res.data || res);
}

async function loadProjects(apiKey) {
    const res = await fetchJson('https://api.weeek.net/public/v1/tm/projects', apiKey);
    return res && (res.projects || res.items || res.data || []);
}

function fillSelect(select, items, getValue, getLabel, selectedValue) {
    select.innerHTML = '';
    for (const item of items) {
        const opt = document.createElement('option');
        opt.value = String(getValue(item));
        opt.textContent = String(getLabel(item));
        if (selectedValue != null && String(selectedValue) === opt.value) opt.selected = true;
        select.appendChild(opt);
    }
}

async function init() {
    const { weeekApiKey, weeekWorkspaceId, weeekProjectId, weeekAuthEmail } = await loadFromStorage();
    if (weeekApiKey) dom.apiKey.value = weeekApiKey;
    if (weeekAuthEmail) dom.email.value = weeekAuthEmail;

    dom.saveKeyBtn.addEventListener('click', async () => {
        const apiKey = dom.apiKey.value.trim();
        if (!apiKey) {
            setStatus('Введите API ключ', 'err');
            return;
        }
        await saveToStorage({ weeekApiKey: apiKey });
        setStatus('Ключ сохранён. Загружаю рабочее пространство...', 'info');
        try {
            const ws = await getWorkspace(apiKey);
            const wsId = ws && (ws.id || ws.workspaceId);
            fillSelect(dom.workspaceSelect, wsId ? [ws] : [], w => w.id ?? w.workspaceId, w => w.title ?? w.name ?? `WS ${w.id}`, wsId);
            if (wsId) await saveToStorage({ weeekWorkspaceId: String(wsId) });
            dom.projectsBlock.hidden = false;
            const projects = await loadProjects(apiKey);
            fillSelect(dom.projectSelect, projects, p => p.id ?? p.projectId, p => p.title ?? p.name ?? `PRJ ${p.id}`, weeekProjectId);
            setStatus('Выберите проект и сохраните.', 'ok');
        } catch (e) {
            setStatus('Не удалось получить данные. Проверьте ключ.', 'err');
            dom.projectsBlock.hidden = false; // Разрешаем ручной выбор, если поля будут заполнены позже
        }
    });

    dom.workspaceSelect.addEventListener('change', async () => {
        const wsId = dom.workspaceSelect.value;
        if (wsId) await saveToStorage({ weeekWorkspaceId: wsId });
    });

    dom.saveProjectBtn.addEventListener('click', async () => {
        const apiKey = dom.apiKey.value.trim();
        const workspaceId = dom.workspaceSelect.value;
        const projectId = dom.projectSelect.value;
        await saveToStorage({ weeekApiKey: apiKey, weeekWorkspaceId: workspaceId, weeekProjectId: projectId });
        setStatus('Проект сохранён.', 'ok');
    });

    dom.loginBtn.addEventListener('click', async () => {
        const email = dom.email.value.trim();
        const password = dom.password.value;
        if (!email || !password) {
            dom.authState.textContent = 'Введите email и пароль';
            dom.authState.style.color = '#dc2626';
            return;
        }
        dom.authState.textContent = 'Выполняю вход…';
        dom.authState.style.color = '#6b7280';
        try {
            const res = await browser.runtime.sendMessage({
                type: 'weeek.login',
                payload: { email, password },
            });
            if (res && res.ok) {
                await saveToStorage({ weeekAuthEmail: email });
                dom.authState.textContent = 'Вошли по сессии (cookie)';
                dom.authState.style.color = '#16a34a';
            } else {
                dom.authState.textContent = 'Ошибка входа';
                dom.authState.style.color = '#dc2626';
            }
        } catch (e) {
            dom.authState.textContent = 'Ошибка входа';
            dom.authState.style.color = '#dc2626';
        }
    });

    if (weeekApiKey) {
        try {
            const ws = await getWorkspace(weeekApiKey);
            const wsId = ws && (ws.id || ws.workspaceId);
            fillSelect(dom.workspaceSelect, wsId ? [ws] : [], w => w.id ?? w.workspaceId, w => w.title ?? w.name ?? `WS ${w.id}`, weeekWorkspaceId || wsId);
            if (wsId && !weeekWorkspaceId) await saveToStorage({ weeekWorkspaceId: String(wsId) });
            dom.projectsBlock.hidden = false;
            const projects = await loadProjects(weeekApiKey);
            fillSelect(dom.projectSelect, projects, p => p.id ?? p.projectId, p => p.title ?? p.name ?? `PRJ ${p.id}`, weeekProjectId);
        } catch {
            // молча, пользователь может нажать сохранить позже
        }
    }
}


document.addEventListener('DOMContentLoaded', init);
