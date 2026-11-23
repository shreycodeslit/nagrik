// Who fixes what in Gurugram, and how to reach them.
// Routing is a plain lookup, not an AI guess: the model says what the problem is and what kind of road it's on,
// and this table decides the department and channel. Numbers were collected in Nov 2026 from the sources below;
// civic numbers change, so the app always shows "check before filing".
import type { IssueId } from './issues';

export interface Channel { kind: 'whatsapp' | 'phone' | 'portal' | 'app'; label: string; value: string; href: string; note?: string }
export interface Route { department: string; departmentHi: string; body: 'MCG' | 'GMDA' | 'MCG or GMDA'; channels: Channel[]; why: string }

export const SOURCES = [
  { label: 'MCG WhatsApp service (The Tribune, Apr 2026)', url: 'https://www.tribuneindia.com/news/gurugram/mcg-launches-whatsapp-governance-in-gurugram-get-property-tax-alerts-bills-complaints-updates-on-phone/' },
  { label: 'GMDA complaint channels (Lokmat Times, Jul 2024)', url: 'https://www.lokmattimes.com/national/gurugram-gmda-integrates-whatsapp-social-media-platforms-for-complaint-registration/amp' },
  { label: 'MCG helplines and helpdesk (ComplaintHub)', url: 'https://citizen.complainthub.org/t/how-can-i-file-civic-complaints-of-municipal-corporation-gurugram-mcg/1748' },
];
export const CHECKED_ON = 'November 2026';

const WHATSAPP: Channel = { kind: 'whatsapp', label: 'WhatsApp (photos accepted)', value: '78400 01817', href: 'https://wa.me/917840001817', note: 'Gurugram’s shared complaint line for MCG and GMDA' };
const HELPDESK: Channel = { kind: 'portal', label: 'Online helpdesk', value: 'services.gmda.gov.in/helpdesk', href: 'https://services.gmda.gov.in/helpdesk/open.php' };
const MISSED_CALL: Channel = { kind: 'phone', label: 'Missed call, they call back', value: '98733 53224', href: 'tel:+919873353224' };
const MCG_TOLLFREE: Channel = { kind: 'phone', label: 'MCG citizen helpline (toll-free)', value: '1800 180 1817', href: 'tel:18001801817' };
const GARBAGE_LINE: Channel = { kind: 'phone', label: 'Garbage collection (toll-free)', value: '1800 102 5952', href: 'tel:18001025952' };
const SEWER_LINE: Channel = { kind: 'phone', label: 'Sewer and septic cleaning', value: '14420', href: 'tel:14420' };
const SWACHHATA: Channel = { kind: 'app', label: 'Swachhata app (Government of India)', value: 'Swachhata-MoHUA', href: 'https://play.google.com/store/apps/details?id=com.ichangemycity.swachhbharat' };

export const ESCALATION = { label: 'CM Window, Haryana', value: 'cmwindow.haryana.gov.in', href: 'https://cmwindow.haryana.gov.in', note: 'If nothing happens after a follow-up, the state grievance portal is the next step.' };

/** Main (master/arterial) roads are GMDA's; sector and colony roads are MCG's. */
export function routeFor(issue: IssueId, roadType: 'main' | 'internal' | 'unknown'): Route {
  const roadBody = roadType === 'main' ? 'GMDA' : roadType === 'internal' ? 'MCG' : 'MCG or GMDA';
  const roadWhy = roadType === 'main' ? 'This looks like a main road, which GMDA maintains.' : roadType === 'internal' ? 'This looks like a sector or colony road, which MCG maintains.' : 'MCG looks after sector roads and GMDA after main roads; the shared WhatsApp line takes both.';
  switch (issue) {
    case 'garbage': return { department: 'Sanitation wing (Swachh Bharat Mission)', departmentHi: 'स्वच्छता विभाग', body: 'MCG', channels: [WHATSAPP, GARBAGE_LINE, SWACHHATA, MCG_TOLLFREE], why: 'Garbage collection is MCG’s job across the city.' };
    case 'dumping': return { department: 'Sanitation wing, C&D waste cell', departmentHi: 'स्वच्छता विभाग (मलबा)', body: 'MCG', channels: [WHATSAPP, HELPDESK, MCG_TOLLFREE], why: 'Construction and demolition waste is handled by MCG’s sanitation wing.' };
    case 'pothole': return { department: 'Engineering wing (roads)', departmentHi: 'इंजीनियरिंग विभाग (सड़क)', body: roadBody, channels: [WHATSAPP, HELPDESK, MISSED_CALL], why: roadWhy };
    case 'footpath': return { department: 'Enforcement and engineering wings', departmentHi: 'प्रवर्तन / इंजीनियरिंग विभाग', body: roadBody, channels: [WHATSAPP, HELPDESK, MCG_TOLLFREE], why: `Encroachment is MCG’s enforcement wing; repairs follow the road. ${roadWhy}` };
    case 'streetlight': return { department: 'Electrical wing (streetlights)', departmentHi: 'विद्युत विभाग (स्ट्रीटलाइट)', body: roadBody, channels: [WHATSAPP, HELPDESK, MCG_TOLLFREE], why: roadWhy };
    case 'manhole': case 'sewage': return { department: 'Sewerage wing', departmentHi: 'सीवरेज विभाग', body: roadBody, channels: [WHATSAPP, SEWER_LINE, HELPDESK], why: 'Sector sewers are MCG’s and master sewers GMDA’s; both take complaints on the shared line.' };
    case 'waterlogging': return { department: 'Drainage wing', departmentHi: 'ड्रेनेज विभाग', body: roadBody, channels: [WHATSAPP, MISSED_CALL, HELPDESK], why: 'Storm drains on main roads are GMDA’s; inside sectors they are MCG’s.' };
    case 'water_leak': return { department: 'Water supply wing', departmentHi: 'जल आपूर्ति विभाग', body: 'MCG or GMDA', channels: [WHATSAPP, MISSED_CALL, HELPDESK], why: 'GMDA supplies bulk water; MCG runs the sector pipelines.' };
    case 'tree': return { department: 'Horticulture wing', departmentHi: 'बागवानी विभाग', body: roadBody, channels: [WHATSAPP, MCG_TOLLFREE, HELPDESK], why: 'Trees along roads are looked after by the road owner’s horticulture wing.' };
    case 'stray_animal': return { department: 'Veterinary and sanitation wing', departmentHi: 'पशु / स्वच्छता विभाग', body: 'MCG', channels: [WHATSAPP, MCG_TOLLFREE], why: 'MCG removes dead animals and runs the animal helpline.' };
    default: return { department: 'Citizen helpline', departmentHi: 'नागरिक हेल्पलाइन', body: 'MCG or GMDA', channels: [WHATSAPP, MCG_TOLLFREE, HELPDESK], why: 'The shared line passes it to the right department.' };
  }
}
