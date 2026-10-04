/**
 * 确认「设置里的微信二维码」在新环境下用哪个地址可访问。
 *
 * 迁移后 wechatQrUrl 里存的还是旧环境域名，旧环境一到期就会 404。
 * 这里对比几个候选地址，找出真正可用的那个，而不是靠猜。
 */
const OLD_ENV = 'chengdu-cat-dog-d5f79cft65d26bed';
const NEW_ENV = 'chuanzhibei-d3gvmowp1e63d7f33';
const KEY = 'settings/wechat-qr/1788766712376-wnfuad-1000022221.jpg';

const candidates = [
  ['旧环境 gateway', `https://${OLD_ENV}.api.tcloudbasegateway.com/v1/storages/object/public/yard-media/${KEY}`],
  ['新环境 gateway', `https://${NEW_ENV}.api.tcloudbasegateway.com/v1/storages/object/public/yard-media/${KEY}`],
  ['新环境 tcb-api', `https://${NEW_ENV}.ap-shanghai.tcb-api.tencentcloudapi.com/v1/storages/object/public/yard-media/${KEY}`],
  ['新环境 服务域名', `https://${NEW_ENV}.service.tcloudbase.com/v1/storages/object/public/yard-media/${KEY}`],
  ['新环境 CDN 桶域名', `https://6368-${NEW_ENV}-1470251683.tcb.qcloud.la/${KEY}`]
];

(async () => {
  for (const [label, url] of candidates) {
    try {
      const r = await fetch(url, { method: 'GET' });
      const type = r.headers.get('content-type') || '-';
      const len = r.headers.get('content-length') || '-';
      console.log(`  ${r.status}  ${String(type).padEnd(24)} ${String(len).padStart(9)}   ${label}`);
    } catch (e) {
      console.log(`  请求失败  ${e.message}   ${label}`);
    }
  }
})();
