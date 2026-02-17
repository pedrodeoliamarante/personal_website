import { useState, useCallback } from 'react';
import { workThreads } from '../data/workThreads';

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export default function WorkApp() {
  const [selectedId, setSelectedId] = useState(workThreads[0]?.id);
  const [threads, setThreads] = useState(() =>
    workThreads.map(t => ({ ...t }))
  );

  const selected = threads.find(t => t.id === selectedId);

  const selectItem = useCallback((id) => {
    setSelectedId(id);
    setThreads(prev => prev.map(t =>
      t.id === id ? { ...t, unread: false } : t
    ));
  }, []);

  const handleKeyDown = useCallback((e) => {
    const idx = threads.findIndex(t => t.id === selectedId);
    if (e.key === 'ArrowDown' && idx < threads.length - 1) {
      e.preventDefault();
      selectItem(threads[idx + 1].id);
    }
    if (e.key === 'ArrowUp' && idx > 0) {
      e.preventDefault();
      selectItem(threads[idx - 1].id);
    }
  }, [threads, selectedId, selectItem]);

  const markRead = () => {
    setThreads(prev => prev.map(t =>
      t.id === selectedId ? { ...t, unread: false } : t
    ));
  };

  const markUnread = () => {
    setThreads(prev => prev.map(t =>
      t.id === selectedId ? { ...t, unread: true } : t
    ));
  };

  return (
    <div className="window-body work-body">
      <div className="mail-toolbar">
        <div className="mail-title">Inbox — Work Experience</div>
        <div className="mail-actions">
          <button className="btn ghost" onClick={markRead}>Mark as read</button>
          <button className="btn ghost" onClick={markUnread}>Mark as unread</button>
        </div>
      </div>

      <div className="mail-layout">
        <aside className="mail-list" aria-label="Thread list" onKeyDown={handleKeyDown}>
          {threads.map((t) => {
            const preview = (t.bullets?.[0] || '').slice(0, 110);
            return (
              <article
                key={t.id}
                className={`mail-item ${t.unread ? 'is-unread' : ''} ${t.id === selectedId ? 'is-selected' : ''}`}
                tabIndex={0}
                onClick={() => selectItem(t.id)}
              >
                <div className="mail-item-top">
                  <span className="mail-from">{t.company}</span>
                  <span className="mail-date">{t.period}</span>
                </div>
                <div className="mail-subject">{t.role}</div>
                <div className="mail-snippet">
                  {preview}{t.bullets?.[0]?.length > 110 ? '…' : ''}
                </div>
                {t.tags && (
                  <div className="mail-tags">
                    {t.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
                  </div>
                )}
              </article>
            );
          })}
        </aside>

        <section className="mail-pane" aria-label="Reader">
          {selected && (
            <>
              <header className="mail-header">
                <div className="mail-subject-lg">{selected.role}</div>
                <div className="mail-meta">
                  <div><strong>From:</strong> {selected.company}</div>
                  <div><strong>Date:</strong> {selected.period}</div>
                </div>
              </header>
              <div className="mail-content">
                {selected.bullets?.length ? (
                  <ul className="mail-bullets">
                    {selected.bullets.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                ) : (
                  <p>No details yet.</p>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
