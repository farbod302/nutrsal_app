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


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
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
  error_content: {
    flex: 1,
    width: "80%",
    margin: "auto",
    display: "flex",
    alignSelf: "center",
    justifyContent: "center",

  },
  abs_view: {
    position: "absolute",
    bottom: "20%",
    // left: "20%",
    width: "100%"
  },
  error_title: {
    textAlign: "center",
    padding: 5,
    color: "#fff",
    fontWeight: "800"
  }
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







export default function App() {
  const web_view_ref = useRef();

  const replace = (link) => {
    if (!link) return
    const clean_link = link.replace("nutrosal://", "")
    if (!clean_link || clean_link.startsWith("exp")) return
    setLink(`https://nutrosal.com/${clean_link}`)
  }

  const [link, setLink] = useState("https://nutrosal.com")
  // const [link, setLink] = useState("http://192.168.50.132:5173")
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
    let token;

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

      } catch (e) {
        token = `invalid_token${e}`;

      }
    } else {
      alert('Must use physical device for Push Notifications');
    }

    return token;
  }

  const Error = () =>
  (
    <View
      style={loading_style.error_container}
    >
      <Image
        style={loading_style.img}
        source={require('./assets/splash_raw.png')}
      />
      <View style={loading_style.error_content}>
        <View style={loading_style.abs_view}>
          <Text style={loading_style.error_title}>
            Error Loading Page
          </Text>
          <Text style={loading_style.error_title}>
            Please check your internet connection
          </Text>

          <Button
            title='Reload'
            onPress={() => { web_view_ref.current.reload() }} />
        </View>
      </View>
    </View>
  )


  const get_token = async (client_id) => {
    const token = await registerForPushNotificationsAsync()
    if (!token || token.indexOf("invalid_token") > -1) return
    await axios.post(
      "https://backend.nutrosal.com/notificationToken",
      {
        client_id,
        token
      }
    )

  }

  const saveFile = async (fileUri, fileName = 'File') => {
    try {
      if (Platform.OS === 'android') {
        const doc = StorageAccessFramework.getUriForDirectoryInRoot('Documents');
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(doc);
        if (!permissions.granted) {
          return;
        }
        try {
          await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, fileName, 'application/pdf')
            .then(async (uri) => {
              await FileSystem.writeAsStringAsync(uri, fileUri.split(',')[1], { encoding: FileSystem.EncodingType.Base64 });
              Alert.alert('Success', 'Report Downloaded Successfully');
              web_view_ref.current.goBack();
            })
            .catch((e) => {
              console.log(e);
            });
        } catch (e) {
          throw new Error(e);
        }
      } else if (Platform.OS === 'ios') {
        const fileUriLocal = `${FileSystem.documentDirectory}${fileName}.pdf`;
        await FileSystem.writeAsStringAsync(fileUriLocal, fileUri.split(',')[1], { encoding: FileSystem.EncodingType.Base64 });

        const shareOptions = {
          mimeType: 'application/pdf',
          dialogTitle: 'Share your PDF',
          UTI: 'com.adobe.pdf',
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

  // const [last, setLast] = useState(Date.now())
  // useEffect(() => {
  //   const handleAppStateChange = (nextAppState) => {
  //     if (nextAppState === 'active') {
  //       const now = Date.now()
  //       if (last + (1000 * 60 * 2) < now || !last) {
  //         setKey((prevKey) => prevKey + 1);
  //       }
  //     } else {
  //       setLast(Date.now())
  //     }
  //   };

  //   const subscription = AppState.addEventListener('change', handleAppStateChange);

  //   return () => {
  //     subscription.remove();
  //   };
  // }, [last]);




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
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data.redirect) {
        setLink("https://nutrosal.com" + data.redirect)
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const checkInitialNotification = async () => {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (response?.notification) {
        const data = response.notification.request.content.data;
        console.log('App opened with notification:', data);
        if (data.redirect) {
          console.log(data.redirect);
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
            console.log(type);
            if (type === "download_pdf") {
              saveFile(data?.data?.base64, "diet.pdf");
            }
            if (type === "notification_token") {
              get_token(data?.data.client_id)
            }
            if (type === "open_browser") {
              const { url } = data
              Linking.openURL(url)
            }
          }}


        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#82e08c',
    paddingBottom: 5
  },
});


