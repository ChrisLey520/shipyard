import type { DeploymentListItem, ProjectDetail } from './index';

/**
 * 项目详情：当前 DTO 与页面视图 1:1。
 * 后续若 UI 需要派生字段或与后端分叉，请在此集中映射。
 */
export function mapProjectDetailDtoToView(dto: ProjectDetail): ProjectDetail {
  return dto;
}

/** 单条部署记录行（表格行模型与 DTO 一致时的恒等映射） */
export function mapDeploymentRow(dto: DeploymentListItem): DeploymentListItem {
  return dto;
}

export function mapDeploymentListDto(rows: DeploymentListItem[]): DeploymentListItem[] {
  return rows.map(mapDeploymentRow);
}
