/**
 * 检查站点设置里的微信二维码地址是否真的可访问。
 *
 * 为什么需要这个：环境迁移后，`yard_settings.public_contact.value.wechatQrUrl`
 * 里存的是**带环境 ID 的完整地址**。图片文件本身搬过去了，但地址没改的话，
 * 旧环境一到期二维码就会变成裂图——而且不会报错，只会静默显示不出来。
 *
 * 用法：node tools/check-qr-url.cjs
 */
const ENV_ID = process.env.YARD_ENV || 'chuanzhibei-d3gvmowp1e63d7f33';
const BUCKET = 'yard-media';
const QR_PATH = process.env.QR_PATH || 'settings/wechat-qr/1788766712376-wnfuad-1000022221.jpg';

const candidates = [
  ['存储网关（推荐，与后端写入格式一致）', `https://${ENV_ID}.api.tcloudbasegateway.com/v1/storages/object/public/${BUCKET}/${QR_PATH}`],
  ['tcb-api 域名', `https://${ENV_ID}.ap-shanghai.tcb-api.tencentcloudapi.com/v1/storages/object/public/${BUCKET}/${QR_PATH}`],
  ['服务域名', `https://${ENV_ID}.service.tcloudbase.com/v1/storages/object/public/${BUCKET}/${QR_PATH}`]
];

(async () => {
  console.log(`环境：${ENV_ID}\n对象：${QR_PATH}\n`);
  let reachable = 0;
  for (const [label, url] of candidates) {
    try {
      const response = await fetch(url);
      const type = response.headers.get('content-type') || '-';
      const size = response.headers.get('content-length') || '-';
      if (response.ok) reachable += 1;
      console.log(`  ${String(response.status).padEnd(4)} ${String(type).padEnd(26)} ${String(size).padStart(8)}   ${label}`);
    } catch (error) {
      console.log(`  失败  ${error.message}   ${label}`);
    }
  }
  console.log(`\n可访问的地址数：${reachable}`);
  if (!reachable) {
    console.log('⚠️ 二维码不可访问——检查对象是否已上传到当前环境的桶，以及设置里的地址是否指向当前环境。');
    process.exit(1);
  }
})();
