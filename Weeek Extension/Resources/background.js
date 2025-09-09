async function getSettings() {
    const { weeekWorkspaceId, weeekMentionUserId } = await browser.storage.local.get(['weeekWorkspaceId', 'weeekMentionUserId']);
    return { workspaceId: weeekWorkspaceId, mentionUserId: weeekMentionUserId };
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

    // Формируем ProseMirror-док с кликабельной ссылкой на MR
    const body = {
        parentId: null,
        content: {
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    attrs: { meta: { id: crypto.randomUUID() }, align: null },
                    content: [
                        {
                            type: 'text',
                            marks: [
                                {
                                    type: 'link',
                                    attrs: {
                                        meta: { id: crypto.randomUUID() },
                                        href: mrUrl,
                                        constructed: false,
                                    },
                                },
                            ],
                            text: mrUrl,
                        },
                    ],
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

async function getWorkspaceMembers() {
    const { workspaceId } = await getSettings();
    if (!workspaceId) return [];
    const resp = await fetch(`https://api.weeek.net/ws/${workspaceId}`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
    });
    if (!resp.ok) return [];
    const data = await resp.json().catch(() => ({}));
    return (data && data.workspace && Array.isArray(data.workspace.members)) ? data.workspace.members : [];
}

async function postWeeekCommentWithMention({ taskKey, mrUrl }) {
    const { workspaceId, mentionUserId } = await getSettings();
    if (!workspaceId) throw new Error('No workspace');
    if (!mentionUserId) throw new Error('No mention user configured');

    const body = {
        parentId: null,
        content: {
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    attrs: { meta: { id: crypto.randomUUID() }, align: null },
                    content: [
                        {
                            type: 'link-entity',
                            attrs: {
                                meta: { id: crypto.randomUUID() },
                                type: 'user',
                                id: mentionUserId,
                            },
                        },
                        { type: 'text', text: ' ' },
                        {
                            type: 'text',
                            marks: [
                                {
                                    type: 'link',
                                    attrs: {
                                        meta: { id: crypto.randomUUID() },
                                        href: mrUrl,
                                        constructed: false,
                                    },
                                },
                            ],
                            text: mrUrl,
                        },
                    ],
                },
            ],
        },
    };

    const url = `https://api.weeek.net/ws/${workspaceId}/tm/tasks/${encodeURIComponent(taskKey)}/comments`;

    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(body),
    });
    if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status}: ${text}`);
    }
    return resp.json().catch(() => ({}));
}

browser.runtime.onMessage.addListener((request, sender) => {
    if (request && request.type === 'weeek.postComment') {
        return postWeeekComment(request.payload)
            .then(() => ({ ok: true }))
            .catch((err) => ({ ok: false, error: String(err && err.message || err) }));
    }
    if (request && request.type === 'weeek.postCommentMention') {
        return postWeeekCommentWithMention(request.payload)
            .then(() => ({ ok: true }))
            .catch((err) => ({ ok: false, error: String(err && err.message || err) }));
    }
    if (request && request.type === 'weeek.login') {
        return weeekLogin(request.payload)
            .then(() => ({ ok: true }))
            .catch((err) => ({ ok: false, error: String(err && err.message || err) }));
    }
    if (request && request.type === 'weeek.members') {
        return getWorkspaceMembers()
            .then((members) => ({ ok: true, data: members }))
            .catch((err) => ({ ok: false, error: String(err && err.message || err) }));
    }
});
