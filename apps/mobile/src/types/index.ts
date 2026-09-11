export interface Settings {
  church_name: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  featured_event_id: string;
  /**
   * Keyed by day name, e.g. { sunday: [...], saturday: [...] }. Naming the
   * days in this type meant a church that meets on Saturday could not be
   * represented at all, however its settings were filled in.
   */
  service_times: Record<string, string[]>;
  bulletin_pdf_url?: string;
  newsletter_pdf_url?: string;
  giving_url?: string;
}

export interface Sermon {
  id: string;
  source: 'pco' | 'youtube';
  title: string | null;
  date: string;
  series_title: string | null;
  speaker: string | null;
  youtube_url: string | null;
  thumbnail: string | null;
}

export interface ChurchEvent {
  id: string;
  name: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  logo_url: string | null;
  registration_url: string | null;
  source: 'registrations' | 'calendar';
}

export interface StaffMember {
  id: number;
  name: string;
  title: string | null;
  email: string | null;
  photo_url: string | null;
  bio: string | null;
  sort_order: number;
}

export interface CarouselSlide {
  id: number;
  image_url: string | null;
  headline: string;
  subtext: string | null;
  button_label: string | null;
  button_link: string | null;
  sort_order: number;
}

export interface Ministry {
  slug: string;
  title: string;
  sub_title: string | null;
  subtext: string | null;
}

export interface Page {
  slug: string;
  title: string;
  sub_title: string | null;
  subtext: string | null;
  content_html: string | null;
  status: string;
}

export interface LiveStream {
  url: string;
  title: string;
  isLive: boolean;
  scheduledStart?: string;
}

export interface HomeData {
  settings: Settings;
  latestSermon: Sermon | null;
  featuredEvent: ChurchEvent | null;
  liveStream: LiveStream | null;
  nextEvent: ChurchEvent | null;
}

export interface PcoUser {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  membership: string | null;
}

export interface HouseholdMember {
  id: string;
  membership_id: string | null;
  name: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  child: boolean;
  birthdate: string | null;
  medical_notes: string | null;
}

export interface Household {
  id: string;
  name: string;
  member_count: number;
  address_id: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  members: HouseholdMember[];
}

export interface CheckIn {
  id: string;
  checked_in_at: string;
  security_code: string | null;
  first_name: string;
  last_name: string;
  kind: string | null;
  event_name: string | null;
}

export interface EventPeriod {
  id: string;
  event_id: string | null;
  event_name: string | null;
  starts_at: string | null;
  ends_at: string | null;
}

export interface Donation {
  id: string;
  amount_cents: number;
  received_at: string;
  payment_method: string | null;
  fund: string;
}

export interface ScheduledService {
  id: string;
  sort_date: string | null;
  dates: string | null;
  service_type_name: string | null;
  team_name: string | null;
  team_position_name: string | null;
  status: string | null;
  position_display_times: string | null;
}
