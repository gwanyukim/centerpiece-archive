(function () {
  const authStatusEl = document.getElementById('auth-status');
  const statusEl = document.getElementById('admin-status');
  const listEl = document.getElementById('item-list');
  const rowsEl = document.getElementById('detail-rows');
  const coverPreview = document.getElementById('cover-preview');
  const editorPanel = document.getElementById('editor-panel');
  const savedPanel = document.getElementById('saved-panel');
  const form = document.getElementById('item-form');
  const sendLoginBtn = document.getElementById('send-login-link');
  const logoutBtn = document.getElementById('logout');
  const loginEmailInput = document.getElementById('login-email');
  const addDetailBtn = document.getElementById('add-detail-row');
  const newItemBtn = document.getElementById('new-item');

  const fields = {
    id: document.getElementById('field-id'),
    brand: document.getElementById('field-brand'),
    name: document.getElementById('field-name'),
    era: document.getElementById('field-era'),
    description: document.getElementById('field-description'),
    coverSrc: document.getElementById('field-cover-src'),
    coverFile: document.getElementById('field-cover-file'),
    coverNote: document.getElementById('field-cover-note')
  };

  const state = {
    items: [],
    editingId: null,
    session: null
  };

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message;
  }

  function setAuthStatus(message) {
    if (authStatusEl) authStatusEl.textContent = message;
  }

  function slugify(text) {
    return String(text || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function setImagePreview(imgEl, src) {
    if (!imgEl) return;
    if (!src) {
      imgEl.removeAttribute('src');
      imgEl.classList.add('is-empty');
      return;
    }
    imgEl.src = src;
    imgEl.classList.remove('is-empty');
  }

  function rowToDetailImage(row) {
    return {
      src: row.querySelector('.detail-src').value.trim(),
      note: row.querySelector('.detail-note').value.trim()
    };
  }

  function getSupabase() {
    if (typeof window.createSupabaseClient !== 'function') return null;
    return window.createSupabaseClient();
  }

  const supabase = getSupabase();

  async function sendMagicLinkDirect(email) {
    const response = await fetch(`${window.SUPABASE_URL}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: window.SUPABASE_PUBLISHABLE_KEY
      },
      body: JSON.stringify({
        email,
        create_user: false,
        email_redirect_to: `${window.location.origin}${window.location.pathname}`
      })
    });

    const payload = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      throw new Error(payload.msg || payload.error_description || `HTTP ${response.status}`);
    }

    return payload;
  }

  async function uploadFile(file, prefix) {
    if (!supabase) {
      throw new Error('Supabase 클라이언트 초기화 실패');
    }

    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
    const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const result = await supabase.storage.from(window.SUPABASE_IMAGE_BUCKET).upload(path, file, {
      upsert: false
    });

    if (result.error) {
      throw result.error;
    }

    const publicUrlResult = supabase.storage.from(window.SUPABASE_IMAGE_BUCKET).getPublicUrl(path);
    return publicUrlResult.data.publicUrl;
  }

  function makeDetailRow(detail) {
    const d = detail || { src: '', note: '' };
    const row = document.createElement('div');
    row.className = 'detail-row';
    row.innerHTML = `
      <div class="detail-row-grid">
        <label>
          상세 사진 업로드
          <input class="detail-file" type="file" accept="image/*" />
        </label>
        <label>
          또는 URL/경로
          <input class="detail-src" type="text" />
        </label>
        <label>
          이 사진 설명
          <textarea class="detail-note" rows="3"></textarea>
        </label>
        <button class="admin-button detail-remove" type="button">제거</button>
      </div>
      <img class="detail-preview upload-preview" alt="상세 사진 미리보기" />
    `;

    const srcInput = row.querySelector('.detail-src');
    const fileInput = row.querySelector('.detail-file');
    const noteInput = row.querySelector('.detail-note');
    const preview = row.querySelector('.detail-preview');
    const removeBtn = row.querySelector('.detail-remove');

    srcInput.value = d.src || '';
    noteInput.value = d.note || '';
    setImagePreview(preview, d.src || '');

    srcInput.addEventListener('input', function () {
      setImagePreview(preview, srcInput.value.trim());
    });

    fileInput.addEventListener('change', async function () {
      if (!fileInput.files[0]) return;
      try {
        const publicUrl = await uploadFile(fileInput.files[0], 'detail');
        srcInput.value = publicUrl;
        setImagePreview(preview, publicUrl);
        setStatus('상세 사진 업로드 완료');
      } catch (error) {
        setStatus(`상세 사진 업로드 실패: ${error.message || '오류'}`);
      }
    });

    removeBtn.addEventListener('click', function () {
      row.remove();
    });

    rowsEl.appendChild(row);
  }

  function resetForm() {
    form.reset();
    rowsEl.innerHTML = '';
    makeDetailRow();
    setImagePreview(coverPreview, '');
    fields.id.value = '';
    state.editingId = null;
  }

  function fillForm(item) {
    fields.id.value = item.id;
    fields.brand.value = item.brand;
    fields.name.value = item.name;
    fields.era.value = item.era;
    fields.description.value = item.description;
    fields.coverSrc.value = item.coverImage.src;
    fields.coverNote.value = item.coverImage.note || '';
    fields.coverFile.value = '';
    setImagePreview(coverPreview, item.coverImage.src || '');

    rowsEl.innerHTML = '';
    if (!item.detailImages.length) {
      makeDetailRow();
    } else {
      item.detailImages.forEach(function (detail) {
        makeDetailRow(detail);
      });
    }

    state.editingId = item.id;
  }

  async function loadItems() {
    if (!supabase) return;

    const result = await supabase
      .from('archive_items')
      .select('id,brand,name,era,description,cover_src,cover_note,detail_images,created_at')
      .order('created_at', { ascending: false });

    if (result.error) {
      throw result.error;
    }

    state.items = result.data
      .map(function (row) {
        return window.normalizeItem({
          id: row.id,
          brand: row.brand,
          name: row.name,
          era: row.era,
          description: row.description,
          coverImage: { src: row.cover_src, note: row.cover_note || '' },
          detailImages: Array.isArray(row.detail_images) ? row.detail_images : []
        });
      })
      .filter(Boolean);
  }

  function renderList() {
    listEl.innerHTML = '';

    if (!state.items.length) {
      listEl.innerHTML = '<li class="item-empty">아직 저장된 아이템이 없습니다.</li>';
      return;
    }

    state.items.forEach(function (item) {
      const li = document.createElement('li');
      li.className = 'item-entry';
      li.innerHTML = `
        <img class="item-thumb" src="${item.coverImage.src}" alt="${item.brand} ${item.name}" />
        <div class="item-summary">
          <p>${item.brand}</p>
          <h3>${item.name}</h3>
          <small>${item.era}</small>
        </div>
        <div class="item-buttons">
          <button class="admin-button" data-action="edit" data-id="${item.id}" type="button">수정</button>
          <button class="admin-button" data-action="delete" data-id="${item.id}" type="button">삭제</button>
        </div>
      `;
      listEl.appendChild(li);
    });
  }

  async function saveItem(event) {
    event.preventDefault();

    if (!supabase) {
      setStatus('저장 불가: Supabase 연결 실패');
      return;
    }

    const brand = fields.brand.value.trim();
    const name = fields.name.value.trim();
    const era = fields.era.value.trim();
    const description = fields.description.value.trim();
    const coverNote = fields.coverNote.value.trim();
    let id = fields.id.value.trim();

    if (!id) {
      id = `${slugify(brand)}-${slugify(name)}-${slugify(era)}`;
      fields.id.value = id;
    }

    let coverSrc = fields.coverSrc.value.trim();
    if (fields.coverFile.files[0]) {
      coverSrc = await uploadFile(fields.coverFile.files[0], 'cover');
      fields.coverSrc.value = coverSrc;
      setImagePreview(coverPreview, coverSrc);
    }

    if (!id || !brand || !name || !description || !coverSrc) {
      setStatus('필수값: 브랜드, 제품명, 설명, 대표사진');
      return;
    }

    const detailImages = Array.from(rowsEl.querySelectorAll('.detail-row'))
      .map(rowToDetailImage)
      .filter(function (entry) {
        return entry.src;
      });

    const payload = {
      id,
      brand,
      name,
      era,
      description,
      cover_src: coverSrc,
      cover_note: coverNote,
      detail_images: detailImages
    };

    const result = await supabase.from('archive_items').upsert(payload);
    if (result.error) {
      throw result.error;
    }

    await loadItems();
    renderList();
    const saved = state.items.find(function (entry) {
      return entry.id === id;
    });
    if (saved) fillForm(saved);
    setStatus('저장 완료');
  }

  async function deleteItem(id) {
    if (!supabase) return;

    const result = await supabase.from('archive_items').delete().eq('id', id);
    if (result.error) {
      throw result.error;
    }

    await loadItems();
    renderList();
    if (state.editingId === id) resetForm();
    setStatus('삭제 완료');
  }

  async function refreshUIBySession() {
    if (!supabase) {
      editorPanel.style.display = 'none';
      savedPanel.style.display = 'none';
      setAuthStatus('Supabase 스크립트 로딩 실패: 브라우저 설정/확장프로그램을 확인하세요.');
      return;
    }

    const sessionResult = await supabase.auth.getSession();
    const session = sessionResult.data.session;

    state.session = session;
    const loggedIn = Boolean(session);

    editorPanel.style.display = loggedIn ? '' : 'none';
    savedPanel.style.display = loggedIn ? '' : 'none';

    if (!loggedIn) {
      setAuthStatus('로그인이 필요합니다.');
      return;
    }

    setAuthStatus(`로그인됨: ${session.user.email}`);
    await loadItems();
    renderList();
    resetForm();
  }

  window.addEventListener('error', function (event) {
    setAuthStatus(`스크립트 오류: ${event.message}`);
  });

  sendLoginBtn.addEventListener('click', async function () {
    const email = (loginEmailInput.value || '').trim();
    if (!email) {
      setAuthStatus('이메일을 입력하세요.');
      return;
    }

    setAuthStatus('로그인 링크 발송 중...');

    try {
      await sendMagicLinkDirect(email);
      setAuthStatus('이메일로 로그인 링크를 보냈습니다. 메일함/스팸함을 확인하세요.');
    } catch (error) {
      setAuthStatus(`로그인 링크 발송 실패: ${error.message || '오류'}`);
    }
  });

  logoutBtn.addEventListener('click', async function () {
    if (!supabase) return;
    await supabase.auth.signOut();
    await refreshUIBySession();
  });

  fields.coverSrc.addEventListener('input', function () {
    setImagePreview(coverPreview, fields.coverSrc.value.trim());
  });

  fields.coverFile.addEventListener('change', async function () {
    if (!fields.coverFile.files[0]) return;
    try {
      const publicUrl = await uploadFile(fields.coverFile.files[0], 'cover');
      fields.coverSrc.value = publicUrl;
      setImagePreview(coverPreview, publicUrl);
      setStatus('대표 사진 업로드 완료');
    } catch (error) {
      setStatus(`대표 사진 업로드 실패: ${error.message || '오류'}`);
    }
  });

  form.addEventListener('submit', function (event) {
    saveItem(event).catch(function (error) {
      setStatus(`저장 실패: ${error.message || '오류'}`);
    });
  });

  addDetailBtn.addEventListener('click', function () {
    makeDetailRow();
  });

  newItemBtn.addEventListener('click', function () {
    resetForm();
  });

  listEl.addEventListener('click', function (event) {
    const button = event.target;
    if (!(button instanceof HTMLButtonElement)) return;

    const action = button.dataset.action;
    const id = button.dataset.id;
    const item = state.items.find(function (entry) {
      return entry.id === id;
    });
    if (!item) return;

    if (action === 'edit') {
      fillForm(item);
      setStatus('수정 모드');
      return;
    }

    if (action === 'delete') {
      if (!window.confirm('삭제할까요?')) return;
      deleteItem(id).catch(function (error) {
        setStatus(`삭제 실패: ${error.message || '오류'}`);
      });
    }
  });

  if (supabase) {
    supabase.auth.onAuthStateChange(function () {
      refreshUIBySession().catch(function (error) {
        setAuthStatus(`세션 확인 실패: ${error.message || '오류'}`);
      });
    });
  }

  setAuthStatus('스크립트 로드 완료. 이메일 입력 후 로그인 링크를 보내세요.');
  refreshUIBySession().catch(function (error) {
    setAuthStatus(`초기 로딩 실패: ${error.message || '오류'}`);
  });
})();
