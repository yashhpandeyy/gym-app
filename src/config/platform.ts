/** Details of the platform itself (the MyGym app), not of any one gym. */
export const platform = {
  name: 'MyGym',
  /** WhatsApp number new gym owners message to get activated, digits only with country code. Leave empty to hide the button. */
  supportWhatsApp: '',
  /** Where owners open the dashboard on a computer: the web build of this app. */
  dashboardUrl: process.env.EXPO_PUBLIC_DASHBOARD_URL ?? 'https://gym-dashboard-62y.pages.dev',
};
