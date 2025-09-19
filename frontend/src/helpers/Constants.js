/**
 * Arquivo de constantes para a aplicação
 */

// URL base da API
//export const API_URL = 'http://localhost:3001';
export const API_URL = 'https://others-tirvu-sprint-backend.pvuzyy.easypanel.host';

// Endpoints da API
export const API_ENDPOINTS = {
  LOGIN: `${API_URL}/api/users/login`,
  REGISTER: `${API_URL}/api/users/register`,
  USERS: `${API_URL}/api/users`,
  SPRINTS: `${API_URL}/api/sprints`,
  BACKLOGS: `${API_URL}/api/backlogs`,
  TASKS: `${API_URL}/api/tasks`,
  MY_TASKS: `${API_URL}/api/tasks/minhas`,
  HOUR_HISTORY: `${API_URL}/api/hour-history`,
  DASHBOARD_COLLABORATORS: `${API_URL}/api/hour-history/dashboard/collaborators`,
  ATTACHMENTS: `${API_URL}/api/attachments`
};