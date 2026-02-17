import { useState, useCallback, useRef } from 'react';
import { contactInfo } from '../data/contactInfo';

export default function ContactApp() {
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  const flash = useCallback((text) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1200);
  }, []);

  const copy = useCallback((text) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      flash('Copied!');
    }).catch(() => {
      flash('Copy failed');
    });
  }, [flash]);

  const handleEmail = () => {
    if (contactInfo.email) {
      location.href = `mailto:${encodeURIComponent(contactInfo.email)}?subject=${encodeURIComponent('Hello Pedro')}`;
    }
  };

  const handleVCard = () => {
    const info = contactInfo;
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${info.name || ''}`,
      `ORG:${info.company || ''}`,
      `TITLE:${info.title || ''}`,
      info.email ? `EMAIL;TYPE=INTERNET:${info.email}` : '',
      info.phone ? `TEL;TYPE=CELL:${info.phone}` : '',
      info.location ? `ADR;TYPE=HOME:;;${info.location.replace(/,/g, ';')}` : '',
      info.website ? `URL:${info.website}` : '',
      info.linkedin ? `X-SOCIALPROFILE;type=linkedin:${info.linkedin}` : '',
      info.github ? `X-SOCIALPROFILE;type=github:${info.github}` : '',
      info.note ? `NOTE:${info.note}` : '',
      'END:VCARD',
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([lines], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (info.name || 'contact') + '.vcf';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  };

  const info = contactInfo;
  const websiteHost = info.website ? new URL(info.website).host : '';

  return (
    <div className="window-body">
      <div className="contact-card">
        <div className="contact-head">
          <img
            className="contact-avatar"
            src="assets/avatar_pedro.jpg"
            alt="Pedro avatar"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div className="contact-meta">
            <div className="contact-name">{info.name}</div>
            {info.title && <div className="contact-title">{info.title}</div>}
            {info.company && <div className="contact-company">{info.company}</div>}
          </div>
        </div>

        <div className="contact-grid">
          {info.email && (
            <div className="row">
              <span>Email</span>
              <a href={`mailto:${info.email}`}>{info.email}</a>
              <button className="mini" onClick={() => copy(info.email)}>Copy</button>
            </div>
          )}
          {info.phone && (
            <div className="row">
              <span>Phone</span>
              <span>{info.phone}</span>
              <button className="mini" onClick={() => copy(info.phone)}>Copy</button>
            </div>
          )}
          {info.location && (
            <div className="row">
              <span>Location</span>
              <span>{info.location}</span>
            </div>
          )}
          {info.website && (
            <div className="row">
              <span>Website</span>
              <a href={info.website} target="_blank" rel="noopener">{websiteHost}</a>
            </div>
          )}
          {(info.linkedin || info.github) && (
            <div className="row">
              <span>Links</span>
              <span className="links">
                {info.linkedin && <a href={info.linkedin} target="_blank" rel="noopener">LinkedIn</a>}
                {info.github && <a href={info.github} target="_blank" rel="noopener">GitHub</a>}
              </span>
            </div>
          )}
          {info.note && (
            <div className="row">
              <span>Note</span>
              <span>{info.note}</span>
            </div>
          )}
        </div>

        <div className="contact-actions">
          <button className="btn" onClick={handleEmail}>Email Me</button>
          <button className="btn" onClick={handleVCard}>Save vCard</button>
        </div>

        <div className={`contact-toast ${toast ? 'show' : ''}`} aria-live="polite">
          {toast}
        </div>
      </div>
    </div>
  );
}
