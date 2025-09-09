function extractTaskKeyFromTitle(title) {
    if (!title) return null;
    // Ищем цифровой taskId в заголовке, например "BBSUP-21991" → 21991
    const match = title.match(/[A-Z]+-(\d{1,9})/);
    return match ? match[1] : null;
}

function findTitleElement() {
    return (
        document.querySelector('h1.title') ||
        document.querySelector('h1.gl-heading-1') ||
        document.querySelector('.detail-page-description .title') ||
        document.querySelector('.issuable-details .title') ||
        document.querySelector('h1')
    );
}

function buildWeeekLink(workspaceId, taskId) {
    return `https://app.weeek.net/ws/${workspaceId}/task/${taskId}`;
}

async function readSettings() {
    const { weeekWorkspaceId } = await browser.storage.local.get(['weeekWorkspaceId']);
    return { workspaceId: weeekWorkspaceId };
}

function injectLinkIfNeeded(titleEl, url) {
    if (!titleEl || !url) return;
    if (titleEl.querySelector('a[data-weeek-link="true"]')) return;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.textContent = 'Weeek';
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.setAttribute('data-weeek-link', 'true');

    const sep = document.createElement('span');
    sep.textContent = ' · ';

    // Вставляем в конец заголовка
    titleEl.appendChild(sep);
    titleEl.appendChild(anchor);
}

function injectActionButton(titleEl, taskKey) {
    if (!titleEl || !taskKey) return;
    if (titleEl.querySelector('button[data-weeek-action="post-comment"]')) return;
    const btn = document.createElement('button');
    btn.textContent = 'Отправить в Weeek';
    btn.type = 'button';
    btn.setAttribute('data-weeek-action', 'post-comment');
    btn.style.marginLeft = '8px';
    btn.style.padding = '2px 8px';
    btn.style.fontSize = '12px';
    btn.style.borderRadius = '6px';
    btn.style.border = '1px solid #d0d0d0';
    btn.style.background = 'transparent';
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', async () => {
        btn.disabled = true;
        const href = location.href;
        const titleText = titleEl.textContent || '';
        try {
            const res = await browser.runtime.sendMessage({
                type: 'weeek.postComment',
                payload: {
                    taskKey,
                    mrUrl: href,
                    mrTitle: titleText.trim(),
                },
            });
            // console.log('Posted comment to Weeek', res);
            if (res && res.ok) {
                btn.textContent = 'Отправлено';
            } else {
                btn.textContent = 'Ошибка';
                btn.disabled = false;
            }
        } catch (e) {
            btn.textContent = 'Ошибка';
            btn.disabled = false;
        }
    });
    const sep = document.createElement('span');
    sep.textContent = ' ';
    titleEl.appendChild(sep);
    titleEl.appendChild(btn);
}

async function tryInject() {
    const titleEl = findTitleElement();
    if (!titleEl) return false;
    if (titleEl.querySelector('a[data-weeek-link="true"]')) return true;
    const titleText = titleEl.textContent || '';
    const taskKey = extractTaskKeyFromTitle(titleText);
    if (!taskKey) return false;
    const { workspaceId } = await readSettings();
    if (!workspaceId) return false;
    const url = buildWeeekLink(workspaceId, taskKey);
    injectLinkIfNeeded(titleEl, url);
    injectActionButton(titleEl, taskKey);
    return true;
}

(async () => {
    let injected = await tryInject();
    if (injected) return;
    const observer = new MutationObserver(async () => {
        const ok = await tryInject();
        if (ok) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
})();
