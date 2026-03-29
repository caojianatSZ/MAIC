'use client';

import { useEffect } from 'react';

interface BrandingSettings {
  primaryColor: string;
  secondaryColor: string;
}

interface BrandingThemeProviderProps {
  organizationId: string;
  children: React.ReactNode;
}

/**
 * 主题提供者组件
 * 从API获取品牌设置并注入CSS变量
 */
export function BrandingThemeProvider({ organizationId, children }: BrandingThemeProviderProps) {
  useEffect(() => {
    async function loadBrandingSettings() {
      try {
        const res = await fetch(`/api/organizations/${organizationId}/branding`);
        if (!res.ok) {
          console.warn('Failed to load branding settings, using defaults');
          return;
        }

        const json = await res.json();
        if (!json.success) {
          console.warn('Failed to load branding settings, using defaults');
          return;
        }

        const { primaryColor, secondaryColor } = json.data;

        // 注入CSS变量到文档根元素
        const root = document.documentElement;
        root.style.setProperty('--brand-primary', primaryColor);
        root.style.setProperty('--brand-secondary', secondaryColor);
      } catch (error) {
        console.error('Error loading branding settings:', error);
      }
    }

    loadBrandingSettings();
  }, [organizationId]);

  return <>{children}</>;
}

/**
 * 主题钩子 - 用于在组件中访问品牌颜色
 */
export function useBrandColors(): BrandingSettings {
  if (typeof window === 'undefined') {
    // SSR fallback
    return {
      primaryColor: '#3B82F6',
      secondaryColor: '#EFF6FF',
    };
  }

  const root = document.documentElement;
  const primaryColor = root.style.getPropertyValue('--brand-primary') || '#3B82F6';
  const secondaryColor = root.style.getPropertyValue('--brand-secondary') || '#EFF6FF';

  return {
    primaryColor,
    secondaryColor,
  };
}

/**
 * 服务端获取品牌设置的辅助函数
 */
export async function getBrandingSettings(organizationId: string): Promise<BrandingSettings> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/organizations/${organizationId}/branding`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      return {
        primaryColor: '#3B82F6',
        secondaryColor: '#EFF6FF',
      };
    }

    const json = await res.json();
    if (!json.success) {
      return {
        primaryColor: '#3B82F6',
        secondaryColor: '#EFF6FF',
      };
    }

    return {
      primaryColor: json.data.primaryColor,
      secondaryColor: json.data.secondaryColor,
    };
  } catch (error) {
    console.error('Error fetching branding settings:', error);
    return {
      primaryColor: '#3B82F6',
      secondaryColor: '#EFF6FF',
    };
  }
}

/**
 * 生成CSS样式字符串用于SSR
 */
export function generateBrandCSS(primaryColor: string, secondaryColor: string): string {
  return `
    :root {
      --brand-primary: ${primaryColor};
      --brand-secondary: ${secondaryColor};
    }
  `.trim();
}
