import { StyleSheet, BackHandler, Alert, Platform, Image, View, Text, Button } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { useRef, useEffect, useState } from 'react';
import * as FileSystem from "expo-file-system";
import * as Sharing from 'expo-sharing';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { StorageAccessFramework } from 'expo-file-system';
import Constants from 'expo-constants';
import axios from "axios"
import * as Linking from 'expo-linking';
import { Audio } from 'expo-av';
import { useCameraPermissions } from 'expo-camera';
import { PanResponder } from 'react-native';
import app_json from "./app.json"
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

const loading_style = StyleSheet.create({
  container: {
    position: 'absolute',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    width: '100%',
  },
  img: {
    position: 'absolute',
    height: '100%',
    width: '100%',
  },
  error_container: {
    position: 'absolute',
    flex: 1,
    height: '100%',
    width: '100%',
  },
  error_background: {
    position: 'absolute',
    height: '100%',
    width: '100%',
  },
  error_content: {
    flex: 1,
  },
  error_title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E3A59',
    textAlign: 'center',
    marginBottom: 12,
  },
  error_subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 60,
  },
  error_text_container: {
    position: 'absolute',
    bottom: 160,
    left: 40,
    right: 40,
    alignItems: 'center',
  },
  reload_button_container: {
    position: 'absolute',
    bottom: 80,
    left: 40,
    right: 40,
  },
  reload_button: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: 'center',
  },
  reload_button_text: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

const Loading = () =>
(
  <View
    style={loading_style.container}
  >
    <Image
      style={loading_style.img}
      source={require('./assets/splash.gif')}
    />
  </View>
)



const version = app_json.expo.version




export default function App() {
  const web_view_ref = useRef();
  const [permission, requestPermission] = useCameraPermissions();

  const replace = (link) => {
    if (!link) return
    const clean_link = link.replace("nutrosal://", "")
    if (!clean_link || clean_link.startsWith("exp")) return
    //redirect to clean link
    if(!web_view_ref.current) return setLink(`https://nutrosal.com/${clean_link}`)
    web_view_ref.current.injectJavaScript(`window.location.href = "https://nutrosal.com/${clean_link}"`)
  }

  const [link, setLink] = useState("https://nutrosal.com")
  // const [link, setLink] = useState("http://192.168.70.162:5173")
  const [key, setKey] = useState(0);
  useEffect(() => {
    Linking.getInitialURL().then(link => {
      replace(link)
    })
    const listener = Linking.addEventListener("url", (e) => { replace(e.url) })
    return () => {
      listener.remove()
    }
  }, [])


  async function registerForPushNotificationsAsync() {
    let token, device_token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        alert('Failed to get push token for push notification!');
        return;
      }
      try {
        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        if (!projectId) {
          throw new Error('Project ID not found');
        }
        console.log("try to get token");
        token = (
          await Notifications.getExpoPushTokenAsync({
            projectId,
          })
        ).data;
        device_token = ""
      } catch (e) {
        token = `invalid_token${e}`;

      }
    } else {
      alert('Must use physical device for Push Notifications');
    }

    return { token, device_token };
  }


  const get_mic_permission = () => {
    Audio.requestPermissionsAsync()
  }

  const [badge, setBadge] = useState(0)

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && 
             gestureState.dx > 0 && 
             evt.nativeEvent.pageX < 50;
    },
    onPanResponderRelease: (evt, gestureState) => {
      if (gestureState.dx > 50 && gestureState.vx > 0.3) {
        handleBackButtonPress();
      }
    },
  });

  const Error = (error) => {
    return (
      <View style={loading_style.error_container}>
      <Image
        style={loading_style.error_background}
        source={require('./assets/no-connection.jpg')}
      />
      <View style={loading_style.error_content}>
      </View>
      <View style={loading_style.error_text_container}>
        <Text style={loading_style.error_title}>
          No internet connection
        </Text>
        <Text style={loading_style.error_subtitle}>
          Please check your internet connection
        </Text>
      </View>
      <View style={loading_style.reload_button_container}>
        <Button
          title="Reload"
          color="#4CAF50"
          onPress={() => { web_view_ref.current.reload() }}
        />
      </View>
    </View>
    );
  };


  const get_token = async (client_id) => {
    const { token, device_token } = await registerForPushNotificationsAsync()
    console.log({ token, device_token });
    if (!token || token.indexOf("invalid_token") > -1) return
    await axios.post(
      "https://backend.nutrosal.com/notificationToken",
      {
        client_id,
        token,
        device_token
      }
    )

  }

  const saveFile = async (fileUri, fileName, file_type) => {
    try {
      if (Platform.OS === 'android') {
        const doc = StorageAccessFramework.getUriForDirectoryInRoot('Documents');
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(doc);
        if (!permissions.granted) {
          return;
        }
        try {
          await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, fileName, file_type || 'application/pdf')
            .then(async (uri) => {
              await FileSystem.writeAsStringAsync(uri, fileUri.split(',')[1], { encoding: FileSystem.EncodingType.Base64 });
              Alert.alert('Success', 'Report Downloaded Successfully');
            })
            .catch((e) => {
              console.log(e);
            });
        } catch (e) {
          throw new Error(e);
        }
      } else if (Platform.OS === 'ios') {
        const fileUriLocal = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUriLocal, fileUri.split(',')[1], { encoding: FileSystem.EncodingType.Base64 });

        const shareOptions = {
          mimeType: file_type || 'application/pdf',
          dialogTitle: 'Share your file',
          UTI: file_type === 'application/pdf' ? 'com.adobe.pdf' : 'public.data',
        };

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUriLocal, shareOptions);
        } else {
          Alert.alert('Error', 'Sharing is not available on this device');
        }
      }
    } catch (err) {
      console.log(err);
    }
  };

  


  const handleBackButtonPress = () => {
    try {
      if (!web_view_ref.current?.goBack) return false;
      web_view_ref.current?.goBack();
      return true;
    } catch (err) {
      console.log("[handleBackButtonPress] Error: ", err.message);
    }
  };

  useEffect(() => {
    BackHandler.addEventListener("hardwareBackPress", handleBackButtonPress);
    return () => {
      BackHandler.removeEventListener("hardwareBackPress", handleBackButtonPress);
    };
  }, []);

  useEffect(() => {

    const badge_count = Notifications.addNotificationReceivedListener(() => {
      console.log("Notife recived");
      setBadge((prevCount) => {
        const newCount = prevCount + 1;
        Notifications.setBadgeCountAsync(newCount);
        return newCount;
      });
    })

    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      setBadge(0);
      Notifications.setBadgeCountAsync(0);
      const data = response.notification.request.content.data;
      if (data.redirect) {
        setLink("https://nutrosal.com" + data.redirect)
      }
    });
    return () => {
      subscription.remove();
      badge_count.remove()
    };
  }, []);



  useEffect(() => {
    const checkInitialNotification = async () => {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (response?.notification) {
        const data = response.notification.request.content.data;
        if (data.redirect) {
          setLink("https://nutrosal.com" + data.redirect)
        }
      }
    };

    checkInitialNotification();
  }, []);
  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={styles.container}
        edges={["top", "right", "left"]}

      >
        <View style={{ flex: 1 }} {...panResponder.panHandlers}>
          <WebView
                key={key}
                startInLoadingState={true}
                cacheEnabled={true}
                ref={web_view_ref}
                allowsBackForwardNavigationGestures={true}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsFullscreenVideo={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                thirdPartyCookiesEnabled
                onContentProcessDidTerminate={() => {
                  setKey(prv => prv + 1)
                }}
                onRenderProcessGone={() => {
                  setKey(prv => prv + 1)
                }}
                style={{
                  display: "flex",
                  alignSelf: "center",
                  width: "100%",
                  height: "100%",
                  backgroundColor: "#fff"
                }}
                source={{ uri: link }}
                renderLoading={Loading}
                renderError={Error}
                onMessage={(e) => {
                  const { data: json } = e.nativeEvent
                  const data = JSON.parse(json);
                  const { type } = data
                  if (type === "download_pdf") {
                    saveFile(data?.data?.base64, data?.data?.name || "diet",data?.data?.type);
                  }
                  if (type === "notification_token") {
                    get_token(data?.data.client_id)
                  }
                  if (type === "open_browser") {
                    const { url } = data
                    Linking.openURL(url)
                  }
                  if (type === "mic_permission") {
                    get_mic_permission()
                  }
                  if (type === "cam") {
                    requestPermission()
                  }
               
                }}


              />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingBottom: 5
  },
});


