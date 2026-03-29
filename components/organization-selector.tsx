'use client';

import { useState, useEffect } from 'react';
import { Building2, ChevronDown, Check, Search } from 'lucide-react';

export interface Organization {
  id: string;
  name: string;
}

interface OrganizationSelectorProps {
  selectedOrganization: Organization | null;
  onOrganizationChange: (org: Organization | null) => void;
}

export function OrganizationSelector({
  selectedOrganization,
  onOrganizationChange,
}: OrganizationSelectorProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [filteredOrganizations, setFilteredOrganizations] = useState<Organization[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    // 本地搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = organizations.filter((org) =>
        org.name.toLowerCase().includes(query) ||
        org.id.toLowerCase().includes(query)
      );
      setFilteredOrganizations(filtered);
    } else {
      setFilteredOrganizations(organizations);
    }
  }, [searchQuery, organizations]);

  const loadOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setOrganizations(data.organizations);
          setFilteredOrganizations(data.organizations);
        }
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (org: Organization | null) => {
    onOrganizationChange(org);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        {selectedOrganization ? (
          <>
            <Building2 className="w-4 h-4 text-blue-600" />
            <span className="font-medium">{selectedOrganization.name}</span>
          </>
        ) : (
          <>
            <Building2 className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600 dark:text-slate-400">选择机构（可选）</span>
          </>
        )}
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
            {/* 搜索框 */}
            <div className="p-2 border-b border-slate-200 dark:border-slate-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索机构名称或ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
            </div>

            {/* 机构列表 */}
            <div className="p-2 max-h-64 overflow-auto">
              {/* 不选择机构 */}
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                  !selectedOrganization
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span className="flex-1 text-left">个人使用（不关联机构）</span>
                {!selectedOrganization && <Check className="w-4 h-4" />}
              </button>

              {/* 机构列表 */}
              {loading ? (
                <div className="px-3 py-4 text-sm text-slate-500 text-center">
                  加载中...
                </div>
              ) : filteredOrganizations.length === 0 ? (
                <div className="px-3 py-4 text-sm text-slate-500 text-center">
                  {searchQuery ? '未找到匹配的机构' : '暂无机构'}
                  {!searchQuery && (
                    <a
                      href="/register"
                      className="block mt-2 text-blue-600 hover:underline"
                      onClick={() => setIsOpen(false)}
                    >
                      注册新机构 →
                    </a>
                  )}
                </div>
              ) : (
                filteredOrganizations.map((org) => (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => handleSelect(org)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                      selectedOrganization?.id === org.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="flex-1 text-left">{org.name}</span>
                    {selectedOrganization?.id === org.id && <Check className="w-4 h-4" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
