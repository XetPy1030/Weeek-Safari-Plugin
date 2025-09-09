async function getSettings() {
    const { weeekWorkspaceId } = await browser.storage.local.get(['weeekWorkspaceId']);
    return { workspaceId: weeekWorkspaceId };
}

async function weeekLogin({ email, password }) {
    const loginUrl = 'https://api.weeek.net/auth/login';
    const resp = await fetch(loginUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password, remember: true }),
    });
    if (!resp.ok) {
        const t = await resp.text().catch(() => '');
        throw new Error(`Login failed: ${resp.status} ${t}`);
    }
    return resp.json().catch(() => ({}));
}

async function postWeeekComment({ taskKey, mrUrl, mrTitle }) {
    const { workspaceId } = await getSettings();
    if (!workspaceId) throw new Error('No workspace');

    // Формируем контент в формате Weeek (ProseMirror doc)
    const text = `MR: ${mrTitle}\n${mrUrl}`;
    const body = {
        parentId: null,
        content: {
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    attrs: { meta: { id: crypto.randomUUID() }, align: null },
                    content: [{ type: 'text', text }],
                },
            ],
        },
    };

    const url = `https://api.weeek.net/ws/${workspaceId}/tm/tasks/${encodeURIComponent(taskKey)}/comments`;

    async function callWithCookie(endpoint) {
        const resp = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            credentials: "include",
            body: JSON.stringify(body),
        });
        if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            return { ok: false, status: resp.status, text };
        }
        const data = await resp.json().catch(() => ({}));
        return { ok: true, data };
    }

    const cookieRes = await callWithCookie(url);
    if (cookieRes.ok) return cookieRes.data;
    throw new Error(`HTTP ${cookieRes.status}: ${cookieRes.text}`);
}

browser.runtime.onMessage.addListener((request, sender) => {
    if (request && request.type === 'weeek.postComment') {
        return postWeeekComment(request.payload)
            .then(() => ({ ok: true }))
            // .then((res) => ({ ok: true, res }))
            .catch((err) => ({ ok: false, error: String(err && err.message || err) }));
    }
    if (request && request.type === 'weeek.login') {
        return weeekLogin(request.payload)
            .then(() => ({ ok: true }))
            .catch((err) => ({ ok: false, error: String(err && err.message || err) }));
    }
});
