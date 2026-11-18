/** 用户列表 · 页面 schema（真接口：/admin/user/page） */
export const userColumns = [
  { key: 'username', title: '用户名', width: '140px' },
  { key: 'name', title: '姓名', width: '100px' },
  { key: 'deptName', title: '部门' },
  { key: 'phone', title: '手机号', width: '130px' },
  { key: 'sexLabel', title: '性别', width: '70px' },
  { key: 'createTime', title: '创建时间', width: '180px' },
];

export const userPageSchema = {
  indexColumn: { title: '序号', width: '56px' },
  search: [
    { key: 'username', label: '用户名', type: 'input' },
    { key: 'name', label: '姓名', type: 'input' },
  ],
  toolbar: [],
  columns: userColumns,
};
