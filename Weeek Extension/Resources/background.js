async function getSettings() {
    const { weeekApiKey, weeekWorkspaceId } = await browser.storage.local.get(['weeekApiKey', 'weeekWorkspaceId']);
    return { apiKey: weeekApiKey, workspaceId: weeekWorkspaceId };
}

async function postWeeekComment({ taskKey, mrUrl, mrTitle }) {
    const { apiKey, workspaceId } = await getSettings();
    if (!apiKey || !workspaceId) throw new Error('No API key or workspace');

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

    // return { taskKey, mrUrl, mrTitle, url, body };
    // console.log('Posting comment to Weeek', { taskKey, mrUrl, mrTitle, url, body });

    async function callRequest(endpoint) {
        const resp = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (!resp.ok) {
            const body = await resp.text().catch(() => '');
            throw new Error(`HTTP ${resp.status}: ${body}`);
        }
        return resp.json().catch(() => ({}));
    }

    return await callRequest(url);
}

browser.runtime.onMessage.addListener((request, sender) => {
    if (request && request.type === 'weeek.postComment') {
        return postWeeekComment(request.payload)
            .then(() => ({ ok: true }))
            // .then((res) => ({ ok: true, res }))
            .catch((err) => ({ ok: false, error: String(err && err.message || err) }));
    }
});
