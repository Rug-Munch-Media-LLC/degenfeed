/**
 * @degenfeed/web — FeedTuner Component Tests
 *
 * Covers:
 * - Renders with all tabs (mix, topics, presets)
 * - Tab switching between mix/topics/presets
 * - Protocol weight sliders render
 * - Topic weights render and can be adjusted
 * - Saved mixes display
 * - Apply and Close buttons work
 * - Preview section renders
 * - Reset functionality
 */

// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FeedMixConfig, SavedMix } from '../FeedTuner';
import { DEFAULT_WEIGHT, FeedTuner, PROTOCOLS } from '../FeedTuner';

const defaultConfig: FeedMixConfig = {
  protocols: {},
  contentTypes: { posts: 100, images: 50, videos: 50, links: 30, threads: 40 },
  qualityThresholds: {
    globalMinEngagement: 0,
    hideLowQuality: false,
    hideThreshold: 1.0,
    verifiedOnly: false,
    minContentLength: 0,
  },
};

const defaultProps = {
  weights: { crypto: DEFAULT_WEIGHT, defi: DEFAULT_WEIGHT },
  onWeightsChange: vi.fn(),
  onApply: vi.fn(),
  onReset: vi.fn(),
  onClose: vi.fn(),
  feedMixConfig: defaultConfig,
  onFeedMixChange: vi.fn(),
  onFeedMixApply: vi.fn(),
  onFeedMixReset: vi.fn(),
  savedMixes: [] as SavedMix[],
  onSaveMix: vi.fn(),
  onLoadMix: vi.fn(),
  onDeleteMix: vi.fn(),
  algorithmTransparent: false,
  onAlgorithmTransparencyChange: vi.fn(),
  freshnessPreference: 50,
  onFreshnessChange: vi.fn(),
  creatorDiversity: 5,
  onCreatorDiversityChange: vi.fn(),
  exploreRatio: 30,
  onExploreRatioChange: vi.fn(),
  activePreset: null,
  onApplyPreset: vi.fn(),
  feedPresets: [],
};

describe('FeedTuner', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render the dialog with header', () => {
    render(<FeedTuner {...defaultProps} />);
    expect(screen.getByText('Feed Tuner')).toBeDefined();
    expect(screen.getByText('Fine-tune your feed mix and topics')).toBeDefined();
  });

  it('should render all three tab buttons', () => {
    render(<FeedTuner {...defaultProps} />);
    expect(screen.getByText('Mix')).toBeDefined();
    expect(screen.getByText('Topics')).toBeDefined();
    expect(screen.getByText('Presets')).toBeDefined();
  });

  it('should show Mix tab by default', () => {
    render(<FeedTuner {...defaultProps} />);
    // Mix tab is active by default — protocol weights should be visible
    expect(screen.getByText('Protocol Weights')).toBeDefined();
    expect(screen.getByText('Content Types')).toBeDefined();
  });

  it('should switch to Topics tab when clicked', () => {
    render(<FeedTuner {...defaultProps} />);
    fireEvent.click(screen.getByText('Topics'));
    expect(screen.getByText(/Topic Weights/)).toBeDefined();
  });

  it('should switch to Presets tab when clicked', () => {
    render(<FeedTuner {...defaultProps} />);
    fireEvent.click(screen.getByText('Presets'));
    expect(screen.getByText('Saved Mixes')).toBeDefined();
  });

  it('should show "No saved mixes yet" when no saved mixes', () => {
    render(<FeedTuner {...defaultProps} />);
    fireEvent.click(screen.getByText('Presets'));
    expect(screen.getByText('No saved mixes yet.')).toBeDefined();
  });

  it('should show saved mixes when provided', () => {
    const savedMixes: SavedMix[] = [
      {
        id: 'mix1',
        name: 'Crypto Focus',
        description: 'Bitcoin and Ethereum heavy',
        config: defaultConfig,
      },
    ];
    render(<FeedTuner {...defaultProps} savedMixes={savedMixes} />);
    fireEvent.click(screen.getByText('Presets'));
    expect(screen.getByText('Crypto Focus')).toBeDefined();
    expect(screen.getByText('Bitcoin and Ethereum heavy')).toBeDefined();
  });

  it('should call onClose when close button is clicked', () => {
    render(<FeedTuner {...defaultProps} />);
    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when backdrop is clicked', () => {
    render(<FeedTuner {...defaultProps} />);
    const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/60');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(defaultProps.onClose).toHaveBeenCalled();
    }
  });

  it('should call onApply with weights when Apply is clicked on Topics tab', () => {
    render(<FeedTuner {...defaultProps} />);
    fireEvent.click(screen.getByText('Topics'));
    const applyBtn = screen.getByText('Apply');
    fireEvent.click(applyBtn);
    expect(defaultProps.onApply).toHaveBeenCalledTimes(1);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should call onReset when Reset topics is clicked', () => {
    render(<FeedTuner {...defaultProps} />);
    fireEvent.click(screen.getByText('Topics'));
    const resetBtn = screen.getByText('Reset topics');
    fireEvent.click(resetBtn);
    expect(defaultProps.onReset).toHaveBeenCalledTimes(1);
  });

  it('should render Cancel button', () => {
    render(<FeedTuner {...defaultProps} />);
    expect(screen.getByText('Cancel')).toBeDefined();
  });

  it('should render protocol sliders for each protocol', () => {
    render(<FeedTuner {...defaultProps} />);
    // Check that some protocol labels are rendered
    for (const proto of PROTOCOLS.slice(0, 3)) {
      expect(screen.getByText(proto.label)).toBeDefined();
    }
  });

  it('should show default weight percentage on sliders', () => {
    render(<FeedTuner {...defaultProps} />);
    // The Mix tab shows weight percentages
    const pctElements = screen.getAllByText('50%');
    expect(pctElements.length).toBeGreaterThan(0);
  });

  it('should call onFeedMixApply when Apply is clicked on Mix tab', () => {
    render(<FeedTuner {...defaultProps} />);
    const applyBtn = screen.getByText('Apply');
    fireEvent.click(applyBtn);
    expect(defaultProps.onFeedMixApply).toHaveBeenCalledTimes(1);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should render the preview section on Mix tab', () => {
    render(<FeedTuner {...defaultProps} />);
    expect(screen.getByText('Preview')).toBeDefined();
  });

  it('should render "Save current mix" button on Presets tab', () => {
    render(<FeedTuner {...defaultProps} />);
    fireEvent.click(screen.getByText('Presets'));
    expect(screen.getByText('+ Save current mix')).toBeDefined();
  });

  it('should call onSaveMix when Save current mix is clicked', () => {
    render(<FeedTuner {...defaultProps} />);
    fireEvent.click(screen.getByText('Presets'));
    const saveBtn = screen.getByText('+ Save current mix');
    fireEvent.click(saveBtn);
    expect(defaultProps.onSaveMix).toHaveBeenCalledTimes(1);
  });

  it('should show Load and Delete buttons for saved mixes', () => {
    const savedMixes: SavedMix[] = [
      {
        id: 'mix2',
        name: 'Test Mix',
        description: 'A test mix',
        config: defaultConfig,
      },
    ];
    render(<FeedTuner {...defaultProps} savedMixes={savedMixes} />);
    fireEvent.click(screen.getByText('Presets'));

    expect(screen.getByText('Load')).toBeDefined();
    expect(screen.getByText('Delete')).toBeDefined();
  });

  it('should call onLoadMix when Load is clicked on a saved mix', () => {
    const savedMixes: SavedMix[] = [
      {
        id: 'mix3',
        name: 'Mix to Load',
        description: 'Loadable mix',
        config: defaultConfig,
      },
    ];
    render(<FeedTuner {...defaultProps} savedMixes={savedMixes} />);
    fireEvent.click(screen.getByText('Presets'));
    fireEvent.click(screen.getByText('Load'));
    expect(defaultProps.onLoadMix).toHaveBeenCalledTimes(1);
    expect(defaultProps.onLoadMix).toHaveBeenCalledWith(savedMixes[0]);
  });

  it('should call onDeleteMix when Delete is clicked on a saved mix', () => {
    const savedMixes: SavedMix[] = [
      {
        id: 'mix4',
        name: 'Mix to Delete',
        description: 'Deletable mix',
        config: defaultConfig,
      },
    ];
    render(<FeedTuner {...defaultProps} savedMixes={savedMixes} />);
    fireEvent.click(screen.getByText('Presets'));
    fireEvent.click(screen.getByText('Delete'));
    expect(defaultProps.onDeleteMix).toHaveBeenCalledTimes(1);
    expect(defaultProps.onDeleteMix).toHaveBeenCalledWith('mix4');
  });
});
