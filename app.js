const DEFAULT_SETTINGS = {
  phone: '待管理员设置',
  wechat: '待管理员设置',
  hours: '建议提前预约',
  area: '四川省成都市',
  intro: '成都猫狗小院为流浪猫狗提供暂时的安全角落，也为愿意负责的人留下一条认识它们的路。'
};

const DEFAULT_PETS = [
  {
    id: 'xiaomai', name: '小麦', type: '猫咪', status: '待领养', age: '约 2 岁', gender: '母',
    image: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=1100&q=90',
    video: '', tags: ['慢热', '亲人后黏人', '喜欢晒太阳'],
    description: '刚到陌生环境时会安静观察，熟悉之后喜欢靠在人身边打盹。',
    health: '已完成基础驱虫，精神和食欲稳定；绝育安排请以管理员更新为准。',
    requirements: '默认领养要求：稳定住所、家庭成员同意、做好封窗和安全防护、接受后续回访。小麦希望有一个相对安静的居住环境。',
    reason: '', updates: []
  },
  {
    id: 'afu', name: '阿福', type: '狗狗', status: '待领养', age: '约 3 岁', gender: '公',
    image: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1100&q=90',
    video: '', tags: ['爱散步', '友好', '精力充沛'],
    description: '看到牵引绳就会开心地原地转圈，是一只很喜欢和人一起出门的狗狗。',
    health: '已完成基础驱虫；其余健康、疫苗和绝育信息可由管理员在后台更新。',
    requirements: '默认领养要求：稳定住所、家庭成员同意、出门使用牵引、接受后续回访。阿福需要每天稳定的散步时间。',
    reason: '', updates: []
  },
  {
    id: 'huajuan', name: '花卷', type: '猫咪', status: '待领养', age: '约 1 岁', gender: '公',
    image: 'https://images.unsplash.com/photo-1543852786-1cf6624b9987?auto=format&fit=crop&w=1100&q=90',
    video: '', tags: ['好奇', '会玩', '适应力不错'],
    description: '对逗猫棒和纸箱没有抵抗力，习惯之后很愿意主动来找人玩。',
    health: '已完成基础体外驱虫，更多医疗信息将在档案中持续补充。',
    requirements: '默认领养要求：稳定住所、家庭成员同意、做好封窗和安全防护、接受后续回访。',
    reason: '', updates: []
  },
  {
    id: 'yuanbao', name: '元宝', type: '猫咪', status: '已领养', age: '约 4 岁', gender: '母',
    image: 'https://images.unsplash.com/photo-1535268647677-300dbf3d78d1?auto=format&fit=crop&w=1100&q=90',
    video: '', tags: ['已找到家', '爱窗台', '回访中'],
    description: '元宝已经在新家安顿下来。她最喜欢的新习惯，是每天午后守在窗边看楼下的树影。',
    health: '已完成领养，后续生活状态将由回访档案持续补充。',
    requirements: '元宝已经找到温暖的家，感谢每一位曾经关注她的人。',
    reason: '', updates: [
      { date: '第一次回访', text: '新家庭分享了元宝在窗台上打盹的照片。' },
      { date: '一个月后', text: '开始主动陪家人看电视，也愿意接受梳毛。' }
    ]
  },
  {
    id: 'heitang', name: '黑糖', type: '狗狗', status: '暂不适合领养', age: '约 5 岁', gender: '母',
    image: 'https://images.unsplash.com/photo-1558788353-f76d92427f16?auto=format&fit=crop&w=1100&q=90',
    video: '', tags: ['需要恢复', '安静陪伴', '可预约关注'],
    description: '黑糖正在慢慢适应新的环境。她喜欢安静待在人旁边，但目前还需要更多恢复和观察时间。',
    health: '当前处于恢复与观察阶段，开放领养时间请以小院后续更新为准。',
    requirements: '如未来开放领养，将优先沟通能够提供稳定、耐心照顾环境的预约人。',
    reason: '当前仍在恢复与观察中，暂不开放正式领养；可以提前预约关注。', updates: []
  },
  {
    id: 'dongzhi', name: '冬至', type: '狗狗', status: '暂不适合领养', age: '约 2 岁', gender: '公',
    image: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=1100&q=90',
    video: '', tags: ['需要训练', '爱吃零食', '可预约关注'],
    description: '冬至很聪明，也很有自己的主意。目前正在学习更平稳地和陌生人相处。',
    health: '身体状态稳定，正在进行日常适应与行为训练。',
    requirements: '如未来开放领养，希望领养人愿意了解并配合持续训练。',
    reason: '仍在进行行为适应训练，暂不开放正式领养；可以预约关注。', updates: []
  }
];

const APPLICATION_STATUSES = ['未处理', '沟通中', '已通过', '已登记', '等待宠物开放', '已通知', '已转为正式领养申请', '暂不考虑'];
const store = {
  get(key, fallback) {
    try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; }
  },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* demo works without persistence */ } }
};

let pets = store.get('cd-yard-pets', DEFAULT_PETS);
let applications = store.get('cd-yard-applications', []);
let settings = store.get('cd-yard-settings', DEFAULT_SETTINGS);
let filters = { status: '待领养', type: '全部' };
let adminTab = 'overview';
let adminEditing = null;
let returnFocus = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const petById = (id) => pets.find(pet => pet.id === id);
const makeMediaId = () => `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function mediaItems(pet) {
  const listed = Array.isArray(pet.media) ? pet.media.filter(item => item?.url) : [];
  if (listed.length) return listed;
  const legacy = pet.image ? [{ id: 'cover', type: 'image', url: pet.image, isCover: true, caption: '封面照片' }] : [];
  if (pet.video) legacy.push({ id: 'legacy-video', type: 'video', url: pet.video, isCover: false, caption: '视频' });
  return legacy;
}
function coverMedia(pet) {
  return mediaItems(pet).find(item => item.isCover && item.type === 'image') || mediaItems(pet).find(item => item.type === 'image') || mediaItems(pet)[0] || { type: 'image', url: DEFAULT_PETS[0].image };
}
function mediaUrl(item) { return item?.url || ''; }
function galleryMarkup(pet) {
  const media = mediaItems(pet);
  const initial = coverMedia(pet);
  const stage = initial.type === 'video'
    ? `<video class="gallery-stage-media" controls preload="metadata" src="${escapeHtml(mediaUrl(initial))}"></video>`
    : `<img class="gallery-stage-media" src="${escapeHtml(mediaUrl(initial))}" alt="${escapeHtml(pet.name)}的照片" />`;
  const thumbs = media.map((item, index) => `<button class="gallery-thumb ${item.id === initial.id ? 'active' : ''}" type="button" data-gallery-pet="${escapeHtml(pet.id)}" data-gallery-index="${index}" aria-label="查看${escapeHtml(pet.name)}的${item.type === 'video' ? '视频' : '照片'} ${index + 1}">
    ${item.type === 'video' ? `<span class="video-thumb">视频</span>` : `<img src="${escapeHtml(mediaUrl(item))}" alt="" />`}
  </button>`).join('');
  return `<div class="pet-gallery" data-gallery-root="${escapeHtml(pet.id)}"><div class="gallery-stage" data-gallery-stage>${stage}</div>${media.length > 1 ? `<div class="gallery-thumbs">${thumbs}</div>` : ''}</div>`;
}
function switchGallery(petId, index) {
  const pet = petById(petId);
  const media = mediaItems(pet);
  const item = media[index];
  const root = document.querySelector(`[data-gallery-root="${CSS.escape(petId)}"]`);
  if (!pet || !item || !root) return;
  const stage = $('[data-gallery-stage]', root);
  stage.innerHTML = item.type === 'video'
    ? `<video class="gallery-stage-media" controls preload="metadata" src="${escapeHtml(mediaUrl(item))}"></video>`
    : `<img class="gallery-stage-media" src="${escapeHtml(mediaUrl(item))}" alt="${escapeHtml(pet.name)}的照片 ${index + 1}" />`;
  $$('[data-gallery-index]', root).forEach(button => button.classList.toggle('active', Number(button.dataset.galleryIndex) === index));
}
const savePets = () => store.set('cd-yard-pets', pets);
const saveApplications = () => store.set('cd-yard-applications', applications);
const saveSettings = () => store.set('cd-yard-settings', settings);

function statusClass(status) {
  return status === '待领养' ? 'waiting' : status === '已领养' ? 'adopted' : 'pause';
}
function statusAction(status) {
  if (status === '待领养') return '申请领养';
  if (status === '暂不适合领养') return '预约关注';
  return '查看生活档案';
}
function statusDescription(status) {
  if (status === '待领养') return '正在等待合适的家庭';
  if (status === '暂不适合领养') return '现在不开放正式领养，但可以提前预约关注';
  return '已经找到温暖的家，档案会持续更新';
}

function renderStats() {
  const waiting = pets.filter(pet => pet.status === '待领养').length;
  const adopted = pets.filter(pet => pet.status === '已领养').length;
  const appointments = applications.filter(app => app.kind === '预约申请').length;
  $('#stats').innerHTML = `
    <div class="stat"><strong>${waiting}</strong><span>正在等待合适的家</span></div>
    <div class="stat"><strong>${adopted}</strong><span>已领养生活档案</span></div>
    <div class="stat"><strong>${appointments}</strong><span>预约关注记录</span></div>`;
}

function renderContact() {
  $('#contactList').innerHTML = `
    <div><dt>所在区域</dt><dd>${escapeHtml(settings.area)}</dd></div>
    <div><dt>咨询时间</dt><dd>${escapeHtml(settings.hours)}</dd></div>
    <div><dt>微信咨询</dt><dd>${escapeHtml(settings.wechat)}</dd></div>`;
}

function renderPets() {
  const matchingPets = pets.filter(pet => {
    const statusMatches = pet.status === filters.status;
    const typeMatches = filters.type === '全部' || pet.type === filters.type;
    return statusMatches && typeMatches;
  });
  const grid = $('#petGrid');
  grid.innerHTML = matchingPets.map(pet => `
    <article class="pet-card">
      <button class="pet-card-image" data-open-pet="${pet.id}" aria-label="查看${escapeHtml(pet.name)}的详情">
        <img src="${escapeHtml(mediaUrl(coverMedia(pet)))}" alt="${escapeHtml(pet.name)}，${escapeHtml(pet.type)}照片" />
        <span class="status-pill ${statusClass(pet.status)}">${escapeHtml(pet.status)}</span>
      </button>
      <div class="pet-card-content">
        <div class="pet-card-top"><h3>${escapeHtml(pet.name)}</h3><span class="pet-card-meta">${escapeHtml(pet.type)} · ${escapeHtml(pet.gender)} · ${escapeHtml(pet.age)}</span></div>
        <p class="pet-card-description">${escapeHtml(pet.description)}</p>
        <div class="pet-tags">${pet.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
        <button class="card-action" data-open-pet="${pet.id}">${statusAction(pet.status)} <span aria-hidden="true">→</span></button>
      </div>
    </article>`).join('');
  $('#emptyState').classList.toggle('hidden', matchingPets.length > 0);
}

function openModal(content) {
  returnFocus = document.activeElement;
  const backdrop = $('#modalBackdrop');
  $('#modal').innerHTML = content;
  backdrop.classList.remove('hidden');
  backdrop.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  setTimeout(() => $('.modal-close')?.focus(), 20);
}
function closeModal() {
  $('#modalBackdrop').classList.add('hidden');
  $('#modalBackdrop').setAttribute('aria-hidden', 'true');
  $('#modal').innerHTML = '';
  document.body.classList.remove('modal-open');
  returnFocus?.focus?.();
}

function openPetDetail(id) {
  const pet = petById(id);
  if (!pet) return;
  const updates = pet.updates?.length ? `<ul class="archive-updates">${pet.updates.map(update => `<li><strong>${escapeHtml(update.date)}</strong> · ${escapeHtml(update.text)}</li>`).join('')}</ul>` : '';
  const extra = pet.status === '暂不适合领养' ? `<div class="detail-block"><h3>当前说明</h3><p>${escapeHtml(pet.reason || statusDescription(pet.status))}</p></div>` : '';
  const archive = pet.status === '已领养' ? `<div class="detail-block"><h3>回访更新</h3>${updates || '<p>新的生活照片和回访记录会持续补充。</p>'}</div>` : '';
  const action = pet.status === '待领养'
    ? `<button class="button button-primary" data-apply-pet="${pet.id}" data-application-kind="正式领养申请">申请领养</button>`
    : pet.status === '暂不适合领养'
      ? `<button class="button button-primary" data-apply-pet="${pet.id}" data-application-kind="预约申请">预约领养</button>`
      : `<button class="button button-primary" data-scroll-updates>查看回访记录</button>`;
  openModal(`
    <div class="modal-detail modal-detail-media">
      <div class="modal-image">${galleryMarkup(pet)}<span class="status-pill ${statusClass(pet.status)}">${escapeHtml(pet.status)}</span></div>
      <div class="modal-main">
        <button class="modal-close" data-close-modal aria-label="关闭详情"><svg viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
        <p class="modal-overline">${escapeHtml(statusDescription(pet.status))} · ${mediaItems(pet).length} 个影像记录</p>
        <h2 id="modalTitle">${escapeHtml(pet.name)}</h2>
        <p class="modal-description">${escapeHtml(pet.description)}</p>
        <dl class="fact-list"><div><dt>种类</dt><dd>${escapeHtml(pet.type)}</dd></div><div><dt>性别 / 年龄</dt><dd>${escapeHtml(pet.gender)} · ${escapeHtml(pet.age)}</dd></div><div><dt>所在地区</dt><dd>成都 · 猫狗小院</dd></div><div><dt>当前状态</dt><dd>${escapeHtml(pet.status)}</dd></div></dl>
        <div class="detail-block"><h3>健康情况</h3><p>${escapeHtml(pet.health)}</p></div>
        <div class="detail-block"><h3>${pet.status === '已领养' ? '领养后的故事' : '领养要求'}</h3><p>${escapeHtml(pet.requirements)}</p></div>
        ${extra}${archive}
        <div class="modal-actions">${action}<button class="button button-ghost" data-contact-open>咨询管理员</button></div>
      </div>
    </div>`);
}
function openApplicationForm(id, kind) {
  const pet = petById(id);
  if (!pet) return;
  const isAppointment = kind === '预约申请';
  openModal(`
    <div class="form-modal">
      <div class="form-modal-header">
        <div><h2 id="modalTitle">${isAppointment ? '预约关注' : '申请领养'} · ${escapeHtml(pet.name)}</h2><p>${isAppointment ? '${escapeHtml(pet.name)}暂不开放正式领养。留下信息后，小院在开放时会优先与你联系。' : '提交申请不代表立刻领养成功。我们会认真阅读，并在合适时和你沟通。'}</p></div>
        <button class="modal-close" data-close-modal aria-label="关闭表单"><svg viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      </div>
      <form id="applicationForm" data-pet-id="${pet.id}" data-kind="${kind}">
        <div class="form-grid">
          <div class="field"><label for="appName">姓名</label><input id="appName" name="name" required autocomplete="name" /></div>
          <div class="field"><label for="appAge">年龄</label><input id="appAge" name="age" inputmode="numeric" required /></div>
          <div class="field"><label for="appGender">性别</label><select id="appGender" name="gender" required><option value="">请选择</option><option>女</option><option>男</option><option>不方便说明</option></select></div>
          <div class="field"><label for="appContact">联系方式</label><input id="appContact" name="contact" required placeholder="微信或手机号码" /></div>
          <div class="field"><label for="appHome">是否在成都及周边有住所</label><select id="appHome" name="home" required><option value="">请选择</option><option>是</option><option>否</option></select></div>
          <div class="field"><label for="appExperience">是否有养宠经验</label><select id="appExperience" name="experience" required><option value="">请选择</option><option>有</option><option>没有</option><option>正在了解</option></select></div>
          <div class="field"><label for="appFamily">家庭成员是否同意</label><select id="appFamily" name="family" required><option value="">请选择</option><option>全部同意</option><option>部分同意</option><option>尚未沟通</option></select></div>
          <div class="field"><label for="appOtherPets">是否有其他宠物</label><select id="appOtherPets" name="otherPets" required><option value="">请选择</option><option>没有</option><option>有猫</option><option>有狗</option><option>有其他宠物</option></select></div>
          <div class="field full"><label for="appNote">补充说明（可选）</label><textarea id="appNote" name="note" placeholder="如果有想让管理员提前了解的情况，可以写在这里。"></textarea></div>
        </div>
        <p class="form-hint">这些资料仅供成都猫狗小院管理员沟通领养或预约使用，不会在网站公开。</p>
        <button class="button button-primary form-submit" type="submit">提交${isAppointment ? '预约' : '申请'}</button>
      </form>
    </div>`);
}

function openContactModal() {
  openModal(`
    <div class="form-modal">
      <div class="form-modal-header"><div><h2 id="modalTitle">联系成都猫狗小院</h2><p>联系方式可以在管理员后台随时修改。</p></div><button class="modal-close" data-close-modal aria-label="关闭"><svg viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>
      <dl class="contact-list" style="margin-bottom:0; color:var(--ink)">
        <div><dt>所在区域</dt><dd>${escapeHtml(settings.area)}</dd></div>
        <div><dt>咨询时间</dt><dd>${escapeHtml(settings.hours)}</dd></div>
        <div><dt>电话</dt><dd>${escapeHtml(settings.phone)}</dd></div>
        <div><dt>微信</dt><dd>${escapeHtml(settings.wechat)}</dd></div>
      </dl>
      <p class="form-hint">当前为原型示例。上线时可在这里添加真实微信二维码和预约说明。</p>
    </div>`);
}

function toast(message) {
  const toastElement = $('#toast');
  toastElement.textContent = message;
  toastElement.classList.remove('hidden');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => toastElement.classList.add('hidden'), 3200);
}

function openAdmin() {
  returnFocus = document.activeElement;
  $('#adminBackdrop').classList.remove('hidden');
  $('#adminBackdrop').setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  renderAdmin();
  setTimeout(() => $('.admin-nav-button.active')?.focus(), 10);
}
function closeAdmin() {
  $('#adminBackdrop').classList.add('hidden');
  $('#adminBackdrop').setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  returnFocus?.focus?.();
}

function adminPageHead(title, copy, action = '') {
  return `<div class="admin-page-head"><div><h3>${title}</h3><p>${copy}</p></div>${action}</div>`;
}
function renderAdmin() {
  $$('.admin-nav-button').forEach(button => button.classList.toggle('active', button.dataset.adminTab === adminTab));
  const content = $('#adminContent');
  if (adminTab === 'overview') content.innerHTML = renderAdminOverview();
  if (adminTab === 'pets') content.innerHTML = renderAdminPets();
  if (adminTab === 'applications') content.innerHTML = renderAdminApplications();
  if (adminTab === 'settings') content.innerHTML = renderAdminSettings();
  bindAdminEvents();
}
function renderAdminOverview() {
  const waiting = pets.filter(pet => pet.status === '待领养').length;
  const adopted = pets.filter(pet => pet.status === '已领养').length;
  const paused = pets.filter(pet => pet.status === '暂不适合领养').length;
  const openApps = applications.filter(app => app.status === '未处理').length;
  const recent = applications.slice(0, 4);
  return `${adminPageHead('今天的小院', '三位管理员拥有相同的编辑与查看权限。')}
    <div class="dashboard-stats">
      <div class="dashboard-stat"><strong>${waiting}</strong><span>待领养</span></div>
      <div class="dashboard-stat"><strong>${adopted}</strong><span>已领养档案</span></div>
      <div class="dashboard-stat"><strong>${paused}</strong><span>暂不适合领养</span></div>
      <div class="dashboard-stat"><strong>${openApps}</strong><span>待处理申请</span></div>
    </div>
    <div class="admin-block"><h4>最近提交的申请</h4>${recent.length ? `<div class="mini-list">${recent.map(app => `<div class="mini-list-row"><img src="${escapeHtml(petById(app.petId)?.image || DEFAULT_PETS[0].image)}" alt="" /><div><strong>${escapeHtml(app.name)} · ${escapeHtml(app.kind)}</strong><p>${escapeHtml(app.petName)} · ${escapeHtml(app.contact)}</p></div><span>${escapeHtml(app.status)}</span></div>`).join('')}</div>` : '<div class="admin-empty">还没有申请记录。访客提交的领养或预约申请会显示在这里。</div>'}</div>`;
}
function renderAdminPets() {
  const editPet = adminEditing === 'new' ? { id: '', name: '', type: '猫咪', status: '待领养', age: '', gender: '母', image: '', video: '', tags: [], description: '', health: '', requirements: '默认领养要求：稳定住所、家庭成员同意、做好安全防护、接受后续回访。', reason: '', updates: [] } : petById(adminEditing);
  const rows = pets.map(pet => `<div class="admin-row"><img src="${escapeHtml(pet.image)}" alt="" /><div><strong>${escapeHtml(pet.name)}</strong><p>${escapeHtml(pet.type)} · ${escapeHtml(pet.gender)} · ${escapeHtml(pet.age)}</p></div><select data-pet-status="${pet.id}">${['待领养','已领养','暂不适合领养'].map(status => `<option ${pet.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select><span class="status-pill ${statusClass(pet.status)}" style="position:static;justify-self:start">${escapeHtml(pet.status)}</span><button class="admin-edit" data-edit-pet="${pet.id}">编辑</button></div>`).join('');
  return `${adminPageHead('宠物档案', '添加、编辑照片、视频、领养状态及每只宠物的单独要求。', '<button class="admin-primary" data-new-pet>添加宠物</button>')}
    <div class="admin-table">${rows || '<div class="admin-empty">还没有宠物档案。</div>'}</div>
    ${editPet ? renderPetEditor(editPet) : ''}`;
}
function renderPetEditor(pet) {
  const isNew = !pet.id;
  const currentMedia = mediaItems(pet);
  const currentMediaNotice = currentMedia.length ? `<p class="form-hint">当前已有 ${currentMedia.length} 个影像记录。新上传的图片和视频会追加到档案中；正式云端版可拖动排序、替换和删除每一项。</p>` : '';
  return `<div class="admin-block" id="petEditor"><h4>${isNew ? '添加宠物档案' : `编辑 ${escapeHtml(pet.name)} 的档案`}</h4>
    <form id="petEditForm" data-pet-id="${escapeHtml(pet.id)}" class="settings-form">
      <div class="form-grid">
        <div class="field"><label>名字</label><input name="name" value="${escapeHtml(pet.name)}" required /></div>
        <div class="field"><label>种类</label><select name="type"><option ${pet.type === '猫咪' ? 'selected' : ''}>猫咪</option><option ${pet.type === '狗狗' ? 'selected' : ''}>狗狗</option></select></div>
        <div class="field"><label>状态</label><select name="status"><option ${pet.status === '待领养' ? 'selected' : ''}>待领养</option><option ${pet.status === '已领养' ? 'selected' : ''}>已领养</option><option ${pet.status === '暂不适合领养' ? 'selected' : ''}>暂不适合领养</option></select></div>
        <div class="field"><label>性别</label><select name="gender"><option ${pet.gender === '母' ? 'selected' : ''}>母</option><option ${pet.gender === '公' ? 'selected' : ''}>公</option></select></div>
        <div class="field"><label>年龄</label><input name="age" value="${escapeHtml(pet.age)}" placeholder="例如：约 2 岁" required /></div>
        <div class="field"><label>封面照片链接</label><input name="coverImage" value="${escapeHtml(mediaUrl(coverMedia(pet)))}" placeholder="粘贴封面图片链接" /></div>
        <div class="field full"><label>上传或替换封面照片</label><input id="petCoverFile" type="file" accept="image/jpeg,image/png,image/webp" /><span class="form-hint">封面用于宠物列表。图片建议不超过 8 MB。</span></div>
        <div class="field full"><label>生活照片链接（每行一个，可选）</label><textarea name="galleryLinks" placeholder="https://...\nhttps://..."></textarea></div>
        <div class="field full"><label>上传生活照片（可多选）</label><input id="petGalleryFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple /><span class="form-hint">演示版会保存在当前浏览器；正式版会上传到小院自己的 CloudBase 媒体库。</span></div>
        <div class="field full"><label>短视频链接（每行一个，可选）</label><textarea name="videoLinks" placeholder="https://..."></textarea></div>
        <div class="field full"><label>上传短视频（可多选）</label><input id="petVideoFiles" type="file" accept="video/mp4" multiple /><span class="form-hint">建议 MP4、每个不超过 60 MB、时长不超过 90 秒。</span>${currentMediaNotice}</div>
        <div class="field full"><label>简短介绍</label><textarea name="description" required>${escapeHtml(pet.description)}</textarea></div>
        <div class="field full"><label>健康情况</label><textarea name="health" required>${escapeHtml(pet.health)}</textarea></div>
        <div class="field full"><label>默认 / 单独领养要求</label><textarea name="requirements" required>${escapeHtml(pet.requirements)}</textarea></div>
        <div class="field full"><label>暂不适合领养说明（仅该状态需要）</label><textarea name="reason">${escapeHtml(pet.reason || '')}</textarea></div>
      </div>
      <div class="modal-actions"><button class="button button-primary" type="submit">保存档案</button><button class="button button-ghost" type="button" data-cancel-pet>取消</button></div>
    </form>
  </div>`;
}
function renderAdminApplications() {
  const rows = applications.map(app => `<div class="admin-row application-row"><div><strong>${escapeHtml(app.name)} · ${escapeHtml(app.kind)}</strong><small>${escapeHtml(app.contact)} · ${escapeHtml(app.age)} 岁 · ${escapeHtml(app.gender)}</small></div><div><strong>${escapeHtml(app.petName)}</strong><small>${escapeHtml(app.home)} · 养宠经验：${escapeHtml(app.experience)}</small></div><div><small>提交于 ${escapeHtml(app.createdAt)}</small><small>${escapeHtml(app.note || '无补充说明')}</small></div><select data-application-status="${app.id}">${APPLICATION_STATUSES.map(status => `<option ${app.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></div>`).join('');
  return `${adminPageHead('申请记录', '正式领养与预约关注会分开标记，所有状态仅管理员可见。')}
    <div class="admin-table">${rows || '<div class="admin-empty">还没有申请记录。访客提交表单后会出现在这里。</div>'}</div>`;
}
function renderAdminSettings() {
  return `${adminPageHead('网站设置', '修改公开显示的联系方式、所在区域和首页说明。')}
    <form id="settingsForm" class="settings-form">
      <div class="form-grid">
        <div class="field"><label>联系电话</label><input name="phone" value="${escapeHtml(settings.phone)}" /></div>
        <div class="field"><label>微信号 / 微信咨询说明</label><input name="wechat" value="${escapeHtml(settings.wechat)}" /></div>
        <div class="field"><label>咨询时间</label><input name="hours" value="${escapeHtml(settings.hours)}" /></div>
        <div class="field"><label>所在区域</label><input name="area" value="${escapeHtml(settings.area)}" /></div>
        <div class="field full"><label>首页简介</label><textarea name="intro">${escapeHtml(settings.intro)}</textarea></div>
      </div>
      <button class="button button-primary form-submit" type="submit">保存网站设置</button>
    </form>`;
}

function bindAdminEvents() {
  $$('[data-pet-status]').forEach(select => select.addEventListener('change', () => {
    const pet = petById(select.dataset.petStatus);
    if (!pet) return;
    pet.status = select.value;
    savePets(); renderAll(); renderAdmin(); toast(`${pet.name} 已更新为“${pet.status}”`);
  }));
  $$('[data-edit-pet]').forEach(button => button.addEventListener('click', () => { adminEditing = button.dataset.editPet; renderAdmin(); setTimeout(() => $('#petEditor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); }));
  $('[data-new-pet]')?.addEventListener('click', () => { adminEditing = 'new'; renderAdmin(); setTimeout(() => $('#petEditor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); });
  $('[data-cancel-pet]')?.addEventListener('click', () => { adminEditing = null; renderAdmin(); });
  $('#petEditForm')?.addEventListener('submit', handlePetSave);
  $$('[data-application-status]').forEach(select => select.addEventListener('change', () => {
    const app = applications.find(item => item.id === select.dataset.applicationStatus);
    if (app) { app.status = select.value; saveApplications(); renderStats(); toast('申请处理状态已更新'); }
  }));
  $('#settingsForm')?.addEventListener('submit', event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    settings = { ...settings, ...data };
    saveSettings(); renderContact(); toast('网站公开信息已保存');
  });
}

function readFilesAsMedia(files, type) {
  const usable = [...files].filter(file => {
    const validType = type === 'image' ? /^image\/(jpeg|png|webp)$/.test(file.type) : file.type === 'video/mp4';
    const limit = type === 'image' ? 8 * 1024 * 1024 : 60 * 1024 * 1024;
    return validType && file.size <= limit;
  });
  return Promise.all(usable.map(file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ id: makeMediaId(), type, url: reader.result, isCover: false, caption: file.name });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
}
function parseMediaLinks(text, type) {
  return String(text || '').split(/\r?\n/).map(value => value.trim()).filter(value => /^https?:\/\//i.test(value)).map(url => ({ id: makeMediaId(), type, url, isCover: false, caption: type === 'video' ? '短视频' : '生活照片' }));
}
async function handlePetSave(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const id = form.dataset.petId;
  const oldPet = id ? petById(id) : null;
  const coverFile = $('#petCoverFile')?.files?.[0];
  const galleryFiles = $('#petGalleryFiles')?.files || [];
  const videoFiles = $('#petVideoFiles')?.files || [];
  try {
    const [coverUpload, galleryUploads, videoUploads] = await Promise.all([
      coverFile ? readFilesAsMedia([coverFile], 'image') : Promise.resolve([]),
      readFilesAsMedia(galleryFiles, 'image'),
      readFilesAsMedia(videoFiles, 'video')
    ]);
    const previousMedia = oldPet ? mediaItems(oldPet).filter(item => item.id !== coverMedia(oldPet).id || !coverFile) : [];
    const coverUrl = coverUpload[0]?.url || data.coverImage.trim() || mediaUrl(oldPet ? coverMedia(oldPet) : null) || DEFAULT_PETS[0].image;
    const cover = { id: coverUpload[0]?.id || (oldPet ? coverMedia(oldPet).id : makeMediaId()), type: 'image', url: coverUrl, isCover: true, caption: '封面照片' };
    const extras = [
      ...previousMedia.filter(item => item.url !== cover.url).map(item => ({ ...item, isCover: false })),
      ...parseMediaLinks(data.galleryLinks, 'image'),
      ...galleryUploads,
      ...parseMediaLinks(data.videoLinks, 'video'),
      ...videoUploads
    ];
    const seen = new Set([cover.url]);
    const media = [cover, ...extras.filter(item => item.url && !seen.has(item.url) && (seen.add(item.url), true))].slice(0, 16);
    const object = {
      id: id || `pet-${Date.now()}`,
      name: data.name.trim(), type: data.type, status: data.status, age: data.age.trim(), gender: data.gender,
      image: cover.url, video: media.find(item => item.type === 'video')?.url || '', media, tags: id ? (oldPet?.tags || []) : ['新档案'],
      description: data.description.trim(), health: data.health.trim(), requirements: data.requirements.trim(), reason: data.reason.trim(), updates: id ? (oldPet?.updates || []) : []
    };
    if (id) pets = pets.map(pet => pet.id === id ? object : pet); else pets.unshift(object);
    savePets(); adminEditing = null; renderAll(); renderAdmin(); toast(id ? '宠物档案和影像记录已保存' : '新的宠物档案已添加');
  } catch (error) {
    toast('部分文件无法读取，请检查图片或视频格式和大小');
  }
}
function renderAll() {
  renderStats(); renderContact(); renderPets();
}

function setFilter(group, value) {
  filters[group] = value;
  $$(`[data-filter="${group}"]`).forEach(button => {
    const isActive = button.dataset.value === value;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
  renderPets();
}

document.addEventListener('click', event => {
  const galleryTarget = event.target.closest('[data-gallery-pet]');
  if (galleryTarget) { switchGallery(galleryTarget.dataset.galleryPet, Number(galleryTarget.dataset.galleryIndex)); return; }
  const petTarget = event.target.closest('[data-open-pet]');
  if (petTarget) { openPetDetail(petTarget.dataset.openPet); return; }
  const applyTarget = event.target.closest('[data-apply-pet]');
  if (applyTarget) { openApplicationForm(applyTarget.dataset.applyPet, applyTarget.dataset.applicationKind); return; }
  if (event.target.closest('[data-close-modal]')) { closeModal(); return; }
  if (event.target.closest('[data-contact-open]')) { openContactModal(); return; }
  if (event.target.closest('[data-scroll-updates]')) { closeModal(); document.querySelector('#stories')?.scrollIntoView({ behavior: 'smooth' }); return; }
  const filterButton = event.target.closest('[data-filter]');
  if (filterButton) { setFilter(filterButton.dataset.filter, filterButton.dataset.value); return; }
  if (event.target.closest('#adminButton, #footerAdmin')) { openAdmin(); return; }
  if (event.target.closest('#contactButton')) { openContactModal(); return; }
  if (event.target.closest('#closeAdmin')) { closeAdmin(); return; }
  const adminTabButton = event.target.closest('[data-admin-tab]');
  if (adminTabButton) { adminTab = adminTabButton.dataset.adminTab; adminEditing = null; renderAdmin(); }
});

$('#modalBackdrop').addEventListener('click', event => { if (event.target === $('#modalBackdrop')) closeModal(); });
$('#adminBackdrop').addEventListener('click', event => { if (event.target === $('#adminBackdrop')) closeAdmin(); });

document.addEventListener('submit', event => {
  if (event.target.id !== 'applicationForm') return;
  event.preventDefault();
  const form = event.target;
  const pet = petById(form.dataset.petId);
  if (!pet) return;
  const data = Object.fromEntries(new FormData(form));
  const kind = form.dataset.kind;
  applications.unshift({
    id: `app-${Date.now()}`, petId: pet.id, petName: pet.name, kind,
    status: kind === '预约申请' ? '已登记' : '未处理', ...data,
    createdAt: new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date())
  });
  saveApplications(); renderStats(); closeModal();
  toast(kind === '预约申请' ? `已登记对${pet.name}的预约关注` : `已提交${pet.name}的领养申请`);
});

$('#menuToggle').addEventListener('click', () => {
  const nav = $('#siteNav');
  const expanded = nav.classList.toggle('open');
  $('#menuToggle').setAttribute('aria-expanded', String(expanded));
  $('#menuToggle').setAttribute('aria-label', expanded ? '关闭导航' : '打开导航');
});
$$('#siteNav a').forEach(link => link.addEventListener('click', () => { $('#siteNav').classList.remove('open'); $('#menuToggle').setAttribute('aria-expanded', 'false'); }));
window.addEventListener('scroll', () => $('.site-header').classList.toggle('scrolled', window.scrollY > 10), { passive: true });
document.addEventListener('keydown', event => { if (event.key === 'Escape') { if (!$('#modalBackdrop').classList.contains('hidden')) closeModal(); else if (!$('#adminBackdrop').classList.contains('hidden')) closeAdmin(); } });

renderAll();


