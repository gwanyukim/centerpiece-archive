const SUPABASE_URL = 'https://ivoieipceangpinnedpd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_373hD2fL47vgruAWe4oL2A_MICSBB-B';
const SUPABASE_IMAGE_BUCKET = 'centerpiece-images';

const defaultArchiveItems = [
  {
    id: 'prada-nylon-shoulder-2003',
    brand: 'Prada',
    name: 'Nylon Shoulder Bag',
    era: '2003',
    coverImage: {
      src: 'assets/bag-01.svg',
      note: '메인 실루엣. 가벼운 바디와 간결한 볼륨.'
    },
    detailImages: [
      { src: 'assets/bag-02.svg', note: '핸들 비율과 입구 라인이 깔끔한 버전.' },
      { src: 'assets/tote-01.svg', note: '같은 시기 무드 비교용 레퍼런스 샷.' }
    ],
    description:
      '초기 2000년대 무드가 잘 살아 있는 나일론 숄더백입니다. 가벼운 소재와 실용적인 수납력이 장점이고, 포멀과 캐주얼 모두에 자연스럽게 연결되는 밸런스가 매력적입니다.'
  }
];

function normalizeMedia(entry) {
  if (typeof entry === 'string') {
    return { src: entry.trim(), note: '' };
  }
  if (!entry || typeof entry !== 'object') {
    return { src: '', note: '' };
  }
  return {
    src: String(entry.src || '').trim(),
    note: String(entry.note || '').trim()
  };
}

function normalizeItem(entry, fallbackId) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const id = String(entry.id || fallbackId || '').trim();
  const brand = String(entry.brand || '').trim();
  const name = String(entry.name || '').trim();
  const era = String(entry.era || '').trim();
  const description = String(entry.description || '').trim();
  const coverImage = normalizeMedia(entry.coverImage || entry.cover_src || '');
  const detailImages = Array.isArray(entry.detailImages || entry.detail_images)
    ? (entry.detailImages || entry.detail_images)
        .map(normalizeMedia)
        .filter((img) => img.src)
    : [];

  if (!id || !brand || !name || !description || !coverImage.src) {
    return null;
  }

  return {
    id,
    brand,
    name,
    era,
    description,
    coverImage,
    detailImages
  };
}

function normalizeItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((entry, idx) => normalizeItem(entry, `item-${idx + 1}`))
    .filter(Boolean);
}

function mapRowToItem(row) {
  return normalizeItem({
    id: row.id,
    brand: row.brand,
    name: row.name,
    era: row.era,
    description: row.description,
    coverImage: {
      src: row.cover_src,
      note: row.cover_note || ''
    },
    detailImages: Array.isArray(row.detail_images) ? row.detail_images : []
  });
}

async function fetchArchiveItemsRemote() {
  const url =
    `${SUPABASE_URL}/rest/v1/archive_items` +
    '?select=id,brand,name,era,description,cover_src,cover_note,detail_images,created_at' +
    '&order=created_at.desc';

  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error('failed to fetch archive items');
  }

  const rows = await response.json();
  return rows.map(mapRowToItem).filter(Boolean);
}

async function getArchiveItems() {
  try {
    const remoteItems = await fetchArchiveItemsRemote();
    if (remoteItems.length > 0) {
      return remoteItems;
    }
  } catch (_) {
    // fall back to defaults
  }
  return normalizeItems(defaultArchiveItems);
}

function createSupabaseClient() {
  if (!window.supabase || !window.supabase.createClient) {
    return null;
  }
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}

window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_PUBLISHABLE_KEY = SUPABASE_PUBLISHABLE_KEY;
window.SUPABASE_IMAGE_BUCKET = SUPABASE_IMAGE_BUCKET;
window.defaultArchiveItems = normalizeItems(defaultArchiveItems);
window.getArchiveItems = getArchiveItems;
window.normalizeItems = normalizeItems;
window.normalizeItem = normalizeItem;
window.createSupabaseClient = createSupabaseClient;
