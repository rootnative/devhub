import { Platform, StyleSheet, Text, View } from 'react-native'

export function App() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>DevHub Example</Text>
      <Text style={styles.body}>
        This {Platform.OS} build came from npx expo run, through the DevHub
        build cache provider.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: '#ffffff',
  },
  title: {
    color: '#1a1a1a',
    fontSize: 24,
    fontWeight: '600',
  },
  body: {
    color: '#1a1a1a',
    fontSize: 16,
    textAlign: 'center',
  },
})
