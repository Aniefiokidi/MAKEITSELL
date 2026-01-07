// Update user profile via API
export const updateUserProfile = async (uid, updates) => {
  const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('sessionToken') : null;
  if (!sessionToken) throw new Error('Not authenticated');
  const response = await fetch('/api/auth/update-profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`
    },
    body: JSON.stringify({ uid, ...updates })
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error || 'Failed to update profile');
  // Update localStorage
  if (typeof window !== 'undefined') {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (updates.displayName) currentUser.name = updates.displayName;
    if (updates.email) currentUser.email = updates.email;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
  }
  return result;
};
