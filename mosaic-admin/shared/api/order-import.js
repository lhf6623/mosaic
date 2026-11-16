/** 委托单（进口订单）接口（旧仓 /api/orderImport* 一系） */
import { get, postJson } from '../http.js';

/** 列表分页（旧仓分页参数是 current / size） */
export const getOrderImportPage = (params) => get('/api/orderImport/page', params);

/** 单条详情（/get/{id}，path 传参） */
export const getOrderImportDetail = (id) => get('/api/orderImport/get/' + encodeURIComponent(id));

/** 明细行分页（orderId 是主表 id） */
export const getOrderImportDetailPage = (params) => get('/api/orderImportDetail/page', params);

/** 审批记录（返回数组，不是分页对象） */
export const getOrderImportAuditList = (id) =>
  get('/api/orderImport/auditList/' + encodeURIComponent(id));
/** 更新主表 + 明细（旧仓表单提交走这条；明细列表键是 orderImportDetailDTOList） */
export const updateOrderImport = (payload) => postJson('/api/orderImport/update', payload);
