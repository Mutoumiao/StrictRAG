/**
 * 目标：知识库设置分片策略弹窗必须能启用策略并保存 recommended，且声明不自动 reindex。
 * 需求：功能表 §4.5
 * 被测：ChunkStrategyPanel
 * 简介：HTTP 真值在 api；本测只核 UI 编排。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { within } from '@testing-library/react';
import { render, screen, userEvent, waitFor } from '@/test/test-utils';

const loadKbChunkStrategies = vi.fn();
const saveKbChunkStrategies = vi.fn();

vi.mock('@/app/(ops)/kb/settings/chunk-strategy.services', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/app/(ops)/kb/settings/chunk-strategy.services')>();
  return {
    ...actual,
    loadKbChunkStrategies: (...args: unknown[]) => loadKbChunkStrategies(...args),
    saveKbChunkStrategies: (...args: unknown[]) => saveKbChunkStrategies(...args),
  };
});

import { ChunkStrategyPanel } from '@/app/(ops)/kb/settings/_components/chunk-strategy-panel';

describe('ChunkStrategyPanel', () => {
  beforeEach(() => {
    loadKbChunkStrategies.mockReset();
    saveKbChunkStrategies.mockReset();
    loadKbChunkStrategies.mockResolvedValue({
      ok: true,
      items: [
        {
          code: 'structure_paragraph',
          name: '结构段落',
          implemented: true,
          system: true,
          docFamilies: ['txt'],
          paramSchema: { contextMode: 'l1_llm' },
          pipelineId: 'ingest-chunk',
          enabled: true,
          recommendedFamilies: ['txt'],
          paramOverrides: null,
        },
        {
          code: 'fixed_window',
          name: '固定窗口',
          implemented: false,
          system: true,
          docFamilies: ['txt'],
          paramSchema: { contextMode: 'l1_llm' },
          pipelineId: 'ingest-chunk',
          enabled: false,
          recommendedFamilies: [],
          paramOverrides: null,
        },
      ],
    });
    saveKbChunkStrategies.mockResolvedValue({ ok: true, items: [] });
  });

  it('打开设置后可勾选并保存，文案含不自动 reindex', async () => {
    render(<ChunkStrategyPanel kbId="kb-1" canWrite />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '设置' }));
    expect(await screen.findByRole('dialog', { name: '分片策略设置' })).toBeInTheDocument();
    expect(screen.getByText(/不会自动全库 reindex/)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /fixed_window/ }));
    await user.click(screen.getByRole('button', { name: '保存策略' }));
    await waitFor(() => {
      expect(saveKbChunkStrategies).toHaveBeenCalled();
    });
    const body = saveKbChunkStrategies.mock.calls[0]?.[1] as {
      items: Array<{ code: string; enabled: boolean }>;
    };
    expect(body.items.find((i) => i.code === 'fixed_window')?.enabled).toBe(true);
  });

  it('overrides 为 l0_template 时展示召回增强关闭', async () => {
    loadKbChunkStrategies.mockResolvedValue({
      ok: true,
      items: [
        {
          code: 'structure_paragraph',
          name: '结构段落',
          implemented: true,
          system: true,
          docFamilies: ['txt'],
          paramSchema: { contextMode: 'l1_llm' },
          pipelineId: 'ingest-chunk',
          enabled: true,
          recommendedFamilies: ['txt'],
          paramOverrides: { contextMode: 'l0_template' },
        },
      ],
    });
    render(<ChunkStrategyPanel kbId="kb-1" canWrite />);
    expect(await screen.findByText('召回增强关闭')).toBeInTheDocument();
  });

  it('打开设置可选 L0 模板并写入 paramOverrides.contextMode', async () => {
    render(<ChunkStrategyPanel kbId="kb-1" canWrite />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '设置' }));
    const trigger = await screen.findByRole('button', { name: '情境前缀 structure_paragraph' });
    await user.click(trigger);
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByRole('option', { name: /L0 模板/ }));
    await user.click(screen.getByRole('button', { name: '保存策略' }));
    await waitFor(() => {
      expect(saveKbChunkStrategies).toHaveBeenCalled();
    });
    const body = saveKbChunkStrategies.mock.calls[0]?.[1] as {
      items: Array<{ code: string; paramOverrides?: Record<string, unknown> }>;
    };
    expect(body.items.find((i) => i.code === 'structure_paragraph')?.paramOverrides).toMatchObject({
      contextMode: 'l0_template',
    });
  });
});
