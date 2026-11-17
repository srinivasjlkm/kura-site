// The list the search box looks through. Built with the site, so it always matches what is published.
import { site, projects, sizeName, url } from '../data/load.js';

export function GET() {
  const types = [...new Set(projects.map((p) => p.type).filter(Boolean))].sort();
  const items = [
    ...projects.map((p) => ({
      t: p.title, u: url(`work/${p.slug}/`), k: [p.type, p.location, p.year].filter(Boolean).join(', '),
      x: [p.type, sizeName(p.size), p.location, p.year, p.status, p.client, ...p.paragraphs].filter(Boolean).join(' '),
      i: url(p.images[0].files[0].src), a: +(p.images[0].w / p.images[0].h).toFixed(3),
    })),
    ...types.map((t) => ({ t: `${t} projects`, u: url(`work/?type=${encodeURIComponent(t)}`), k: `${projects.filter((p) => p.type === t).length} projects`, x: t })),
    { t: 'Studio', u: url('studio/'), k: 'About the practice and its partners', x: ['about us philosophy scope services partners team', ...site.people.map((p) => `${p.name} ${p.role}`), ...(site.studio.paragraphs || [])].join(' ') },
    { t: 'Contact', u: url('contact/'), k: 'Office address and enquiries', x: `contact address email phone office enquiry ${site.contact.fields.address || ''}` },
    { t: 'All work', u: url('work/'), k: `${projects.length} projects`, x: 'work projects portfolio all' },
  ];
  return new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json' } });
}
