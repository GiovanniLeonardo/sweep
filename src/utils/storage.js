import AsyncStorage from '@react-native-async-storage/async-storage';

const SWEEPS_KEY = '@sweepguard_sweeps_v1';

export async function getSweeps() {
  try {
    const raw = await AsyncStorage.getItem(SWEEPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load sweep history:', e);
    return [];
  }
}

export async function saveSweep(sweep) {
  try {
    const current = await getSweeps();
    const updated = [sweep, ...current];
    await AsyncStorage.setItem(SWEEPS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to save sweep:', e);
    return [];
  }
}

export async function deleteSweep(id) {
  try {
    const current = await getSweeps();
    const updated = current.filter((item) => item.id !== id);
    await AsyncStorage.setItem(SWEEPS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to delete sweep:', e);
    return [];
  }
}

export async function clearAllSweeps() {
  try {
    await AsyncStorage.removeItem(SWEEPS_KEY);
    return [];
  } catch (e) {
    console.error('Failed to clear sweeps:', e);
    return [];
  }
}
