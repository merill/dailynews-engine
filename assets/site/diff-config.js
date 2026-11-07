(function (root, factory) {
  const config = factory();
  if (typeof module === 'object' && module.exports) module.exports = config;
  else root.DOC_DIFF_CONFIG = config;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  return {
    // Sources are matched in order. Put query-specific and narrower paths first.
    sources: [
      {
        id: 'graph-api-beta',
        label: 'Microsoft Graph',
        siteUrl: 'https://learn.microsoft.com/graph/api/',
        stripLocale: true,
        query: { view: 'graph-rest-beta' },
        repositoryUrl: 'https://github.com/microsoftgraph/microsoft-graph-docs-contrib',
        repositoryPathPrefix: 'api-reference/beta/api',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'graph-api-v1',
        label: 'Microsoft Graph',
        siteUrl: 'https://learn.microsoft.com/graph/api/',
        stripLocale: true,
        query: { view: 'graph-rest-1.0' },
        repositoryUrl: 'https://github.com/microsoftgraph/microsoft-graph-docs-contrib',
        repositoryPathPrefix: 'api-reference/v1.0/api',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'graph-api-default',
        label: 'Microsoft Graph',
        siteUrl: 'https://learn.microsoft.com/graph/api/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/microsoftgraph/microsoft-graph-docs-contrib',
        repositoryPathPrefix: 'api-reference/v1.0/api',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'fabric-get-started',
        label: 'Microsoft Fabric',
        siteUrl: 'https://learn.microsoft.com/fabric/get-started/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/MicrosoftDocs/fabric-docs',
        repositoryPathPrefix: 'docs/fundamentals',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'azure-learn',
        label: 'Azure',
        siteUrl: 'https://learn.microsoft.com/azure/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/MicrosoftDocs/azure-docs',
        repositoryPathPrefix: 'articles',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'dotnet-learn',
        label: '.NET',
        siteUrl: 'https://learn.microsoft.com/dotnet/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/dotnet/docs',
        repositoryPathPrefix: 'docs',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'powershell-learn',
        label: 'PowerShell',
        siteUrl: 'https://learn.microsoft.com/powershell/scripting/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/MicrosoftDocs/PowerShell-Docs',
        repositoryPathPrefix: 'reference/docs-conceptual',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'microsoft-365-learn',
        label: 'Microsoft 365',
        siteUrl: 'https://learn.microsoft.com/microsoft-365/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/MicrosoftDocs/microsoft-365-docs',
        repositoryPathPrefix: 'microsoft-365',
        defaultBranch: 'public',
        fileExtension: '.md'
      },
      {
        id: 'entra-learn',
        label: 'Microsoft Entra',
        siteUrl: 'https://learn.microsoft.com/entra/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/MicrosoftDocs/entra-docs',
        repositoryPathPrefix: 'docs',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'intune-learn',
        label: 'Microsoft Intune',
        siteUrl: 'https://learn.microsoft.com/intune/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/MicrosoftDocs/memdocs',
        repositoryPathPrefix: 'intune',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'autopilot-learn',
        label: 'Windows Autopilot',
        siteUrl: 'https://learn.microsoft.com/autopilot/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/MicrosoftDocs/memdocs',
        repositoryPathPrefix: 'autopilot',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'fabric-learn',
        label: 'Microsoft Fabric',
        siteUrl: 'https://learn.microsoft.com/fabric/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/MicrosoftDocs/fabric-docs',
        repositoryPathPrefix: 'docs',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'dynamics-365-learn',
        label: 'Dynamics 365',
        siteUrl: 'https://learn.microsoft.com/dynamics365/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/MicrosoftDocs/dynamics365hubpages',
        repositoryPathPrefix: 'dynamics365',
        defaultBranch: 'live',
        fileExtension: '.md'
      },
      {
        id: 'sql-learn',
        label: 'SQL',
        siteUrl: 'https://learn.microsoft.com/sql/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/MicrosoftDocs/sql-docs',
        repositoryPathPrefix: 'docs',
        defaultBranch: 'live',
        fileExtension: '.md'
      },
      {
        id: 'graph-concepts',
        label: 'Microsoft Graph',
        siteUrl: 'https://learn.microsoft.com/graph/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/microsoftgraph/microsoft-graph-docs-contrib',
        repositoryPathPrefix: 'concepts',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'visual-studio-learn',
        label: 'Visual Studio',
        siteUrl: 'https://learn.microsoft.com/visualstudio/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/MicrosoftDocs/visualstudio-docs',
        repositoryPathPrefix: 'docs',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'aspnet-core-learn',
        label: 'ASP.NET Core',
        siteUrl: 'https://learn.microsoft.com/aspnet/core/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/dotnet/AspNetCore.Docs',
        repositoryPathPrefix: 'aspnetcore',
        pathAliases: {
          'introduction-to-aspnet-core': 'overview'
        },
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        id: 'windows-server-learn',
        label: 'Windows Server',
        siteUrl: 'https://learn.microsoft.com/windows-server/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/MicrosoftDocs/windowsserverdocs',
        repositoryPathPrefix: 'WindowsServerDocs',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        // Not public upstream: merill/purview-docs-mirror rebuilds it from Learn.
        id: 'purview-learn',
        label: 'Microsoft Purview',
        siteUrl: 'https://learn.microsoft.com/purview/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/merill/purview-docs-mirror',
        repositoryPathPrefix: 'Purview',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        // Not public upstream: merill/exchange-docs-mirror rebuilds it from Learn.
        id: 'exchange-online-learn',
        label: 'Exchange Online',
        siteUrl: 'https://learn.microsoft.com/exchange/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/merill/exchange-docs-mirror',
        repositoryPathPrefix: 'Exchange/ExchangeOnline',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        // Not public upstream: merill/sharepoint-docs-mirror rebuilds it from Learn.
        id: 'sharepoint-online-learn',
        label: 'SharePoint Online',
        siteUrl: 'https://learn.microsoft.com/sharepoint/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/merill/sharepoint-docs-mirror',
        repositoryPathPrefix: 'SharePoint/SharePointOnline',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        // Not public upstream: merill/teams-docs-mirror rebuilds it from Learn.
        id: 'teams-learn',
        label: 'Microsoft Teams',
        siteUrl: 'https://learn.microsoft.com/microsoftteams/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/merill/teams-docs-mirror',
        repositoryPathPrefix: 'Teams',
        defaultBranch: 'main',
        fileExtension: '.md'
      },
      {
        // Not public upstream: merill/security-docs-mirror rebuilds it from Learn.
        id: 'security-learn',
        label: 'Microsoft security guidance',
        siteUrl: 'https://learn.microsoft.com/security/',
        stripLocale: true,
        repositoryUrl: 'https://github.com/merill/security-docs-mirror',
        repositoryPathPrefix: 'security-docs',
        defaultBranch: 'main',
        fileExtension: '.md'
      }
    ]
  };
}));
