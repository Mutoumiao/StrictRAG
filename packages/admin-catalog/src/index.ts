/**
 * @strict-rag/admin-catalog
 * 权限码 + 角色模板 + admin 菜单树 SSOT（ADR-051 / ADR-056）
 */

export {
  ALL_PERMISSION_CODES,
  getPermissionDef,
  isPermissionCode,
  PERMISSION_DEFINITIONS,
  PERMISSIONS,
  type PermissionCode,
  type PermissionDef,
  type PermissionKind,
  type PermissionScope,
} from './permissions.js';

export {
  defaultCodesForRoles,
  getRoleTemplate,
  ROLE_TEMPLATES,
  roleBypassesKbMembership,
  type RoleTemplate,
  type RoleTemplateCode,
} from './role-templates.js';

export {
  filterMenuByCodes,
  MENU_TREE,
  type MenuNode,
} from './menu-tree.js';
