/**
 * 管理员「代申请人更正资料」逻辑的单元测试。
 *
 * 直接从 app.js 里抽出真实的 applicantEditsFromForm 函数来测，
 * 避免测试代码和线上代码各写一份而漂移。
 *
 * 重点是两条不变式：
 *   1. 只有真正被改动过的字段才会进入写入补丁（否则管理员改一下状态，
 *      就会把申请人在别处刚做的自助修改覆盖回旧值）；
 *   2. 取值不合法时直接报错，不写入半截数据。
 *
 * 用法：node tools/test-admin-applicant-edit.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function extractFunction(text, name) {
  const start = text.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`在 app.js 里没有找到函数 ${name}`);
  let depth = 0;
  for (let i = text.indexOf('{', start); i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error(`函数 ${name} 的花括号不匹配`);
}

const applicantEditsFromForm = new Function(`${extractFunction(source, 'applicantEditsFromForm')}; return applicantEditsFromForm;`)();

// 用可控的表单数据替换 FormData，被测函数本身保持原样。
const RealFormData = globalThis.FormData;
let fields = {};
globalThis.FormData = class { get(key) { return Object.prototype.hasOwnProperty.call(fields, key) ? fields[key] : null; } };
const fakeForm = {};
const withFields = values => { fields = values; return fakeForm; };

let passed = 0;
let failed = 0;
function check(label, condition, detail = '') {
  if (condition) { passed += 1; console.log(`✅ ${label}`); }
  else { failed += 1; console.log(`❌ ${label}${detail ? `\n     ${detail}` : ''}`); }
}
function throws(label, fn, expected) {
  try { fn(); check(label, false, '没有抛出错误'); }
  catch (error) { check(label, error.message === expected, `实际：${error.message}`); }
}

const loaded = {
  name: '张三', age: 30, gender: '女', contact: '13800001111', home: '是',
  experience: '有', family: '全部同意', otherPets: '没有', note: '原来的备注'
};
const formValuesFrom = app => ({
  applicantName: app.name,
  applicantAge: String(app.age),
  applicantGender: app.gender,
  applicantContact: app.contact,
  applicantHome: app.home,
  applicantExperience: app.experience,
  applicantFamily: app.family,
  applicantOtherPets: app.otherPets,
  applicantNote: app.note
});

console.log('--- 1. 没有改动时不写入任何字段 ---');
let result = applicantEditsFromForm(withFields(formValuesFrom(loaded)), { ...loaded });
check('补丁为空', Object.keys(result.patch).length === 0, JSON.stringify(result.patch));
check('视图也没有变化', Object.keys(result.view).length === 0, JSON.stringify(result.view));

console.log('\n--- 2. 只改姓名时只写姓名 ---');
result = applicantEditsFromForm(withFields({ ...formValuesFrom(loaded), applicantName: '李四' }), { ...loaded });
check('只包含 applicant_name', JSON.stringify(Object.keys(result.patch)) === '["applicant_name"]', JSON.stringify(result.patch));
check('值正确', result.patch.applicant_name === '李四', result.patch.applicant_name);

console.log('\n--- 3. 改联系方式时同步规范化 ---');
result = applicantEditsFromForm(withFields({ ...formValuesFrom(loaded), applicantContact: '138-0000 2222' }), { ...loaded });
check('同时写入 contact 与 contact_normalized', 'contact' in result.patch && 'contact_normalized' in result.patch, JSON.stringify(result.patch));
check('规范化去掉了连字符与空格', result.patch.contact_normalized === '13800002222', result.patch.contact_normalized);

console.log('\n--- 4. 每类字段都能单独改动 ---');
const singleChanges = [
  ['applicantAge', '31', 'applicant_age'],
  ['applicantGender', '男', 'applicant_gender'],
  ['applicantHome', '否', 'has_chengdu_home'],
  ['applicantExperience', '没有', 'experience'],
  ['applicantFamily', '部分同意', 'family_agreement'],
  ['applicantOtherPets', '有猫', 'other_pets'],
  ['applicantNote', '新的备注', 'note']
];
for (const [key, value, column] of singleChanges) {
  const single = applicantEditsFromForm(withFields({ ...formValuesFrom(loaded), [key]: value }), { ...loaded });
  check(`改 ${key} 只写 ${column}`, JSON.stringify(Object.keys(single.patch)) === `["${column}"]`, JSON.stringify(single.patch));
}

console.log('\n--- 5. 非法输入必须报错且不写入 ---');
throws('姓名为空时报错', () => applicantEditsFromForm(withFields({ ...formValuesFrom(loaded), applicantName: '   ' }), { ...loaded }), '申请人姓名不能为空。');
throws('年龄为 12 时报错', () => applicantEditsFromForm(withFields({ ...formValuesFrom(loaded), applicantAge: '12' }), { ...loaded }), '申请人年龄需要是 18 到 100 之间的整数。');
throws('年龄为小数时报错', () => applicantEditsFromForm(withFields({ ...formValuesFrom(loaded), applicantAge: '30.5' }), { ...loaded }), '申请人年龄需要是 18 到 100 之间的整数。');
throws('联系方式清空时报错', () => applicantEditsFromForm(withFields({ ...formValuesFrom(loaded), applicantContact: '' }), { ...loaded }), '联系方式不能为空。');
throws('性别非法时报错', () => applicantEditsFromForm(withFields({ ...formValuesFrom(loaded), applicantGender: '未知' }), { ...loaded }), '请选择有效的性别。');
throws('住所非法时报错', () => applicantEditsFromForm(withFields({ ...formValuesFrom(loaded), applicantHome: '也许' }), { ...loaded }), '请选择是否在成都及周边有住所。');
throws('养宠经验非法时报错', () => applicantEditsFromForm(withFields({ ...formValuesFrom(loaded), applicantExperience: '很多' }), { ...loaded }), '请选择有效的养宠经验。');
throws('家庭意见非法时报错', () => applicantEditsFromForm(withFields({ ...formValuesFrom(loaded), applicantFamily: '都同意' }), { ...loaded }), '请选择有效的家庭成员意见。');
throws('现有宠物非法时报错', () => applicantEditsFromForm(withFields({ ...formValuesFrom(loaded), applicantOtherPets: '有兔子' }), { ...loaded }), '请选择有效的现有宠物情况。');

console.log('\n--- 6. 原始数据本身就是旧的非法值时不应误报 ---');
const legacy = { ...loaded, age: '30', applicantAge: '30', gender: '不方便说明' };
result = applicantEditsFromForm(withFields({ ...formValuesFrom(legacy) }), { ...legacy });
check('未改动时不报错也不写入', Object.keys(result.patch).length === 0, JSON.stringify(result.patch));

console.log('\n--- 7. 备注清空时写入 null ---');
result = applicantEditsFromForm(withFields({ ...formValuesFrom(loaded), applicantNote: '' }), { ...loaded });
check('note 为 null', result.patch.note === null, JSON.stringify(result.patch));

globalThis.FormData = RealFormData;
console.log(`\n===== 通过 ${passed} 项，失败 ${failed} 项 =====`);
process.exit(failed ? 1 : 0);
