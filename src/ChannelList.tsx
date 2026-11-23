import { CHECKED_ON, type Channel } from './lib/directory';

const ICON: Record<Channel['kind'], string> = {
  whatsapp: 'M5 19l1.2-3.6A7.5 7.5 0 1 1 9 18.6z',
  phone: 'M7 4h3l1.5 4-2 1.5a10 10 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 5 6a2 2 0 0 1 2-2z',
  portal: 'M4 6h16v12H4zM4 9h16',
  app: 'M8 3h8v18H8zM11 18h2',
};

/** The ways to file, best first. WhatsApp opens with the complaint already typed in. */
export default function ChannelList({ channels, text }: { channels: Channel[]; text: string }) {
  return (
    <>
      <ul className="channels">
        {channels.map((c, i) => {
          const href = c.kind === 'whatsapp' && text ? `${c.href}?text=${encodeURIComponent(text)}` : c.href;
          return (
            <li key={c.value} className={i === 0 ? 'first' : ''}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICON[c.kind]} /></svg>
              <div>
                <p className="ch-label">{c.label}{c.note && <small>{c.note}</small>}</p>
                <p className="ch-value"><a href={href} target="_blank" rel="noopener">{c.value}</a></p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="small">WhatsApp opens with the complaint typed in; attach the photo there. Numbers checked in {CHECKED_ON} from public sources; they can change.</p>
    </>
  );
}
