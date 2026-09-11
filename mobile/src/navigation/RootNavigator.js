import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

// Navigators
import TeacherTabNavigator from './TeacherTabNavigator';
import ParentTabNavigator from './ParentTabNavigator';

// Auth Screens
import RoleSelectScreen from '../screens/auth/RoleSelectScreen';
import ParentLoginScreen from '../screens/auth/ParentLoginScreen';
import OTPVerifyScreen from '../screens/auth/OTPVerifyScreen';
import TeacherLoginScreen from '../screens/auth/TeacherLoginScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';

// Secondary Stack Screens
import ConsentScreen from '../screens/parent/ConsentScreen';
import AddChildScreen from '../screens/parent/AddChildScreen';
import ParentReportScreen from '../screens/parent/ParentReportScreen';
import ParentHistoryScreen from '../screens/parent/ParentHistoryScreen';

import ClassSetupScreen from '../screens/teacher/ClassSetupScreen';
import ExcelImportScreen from '../screens/teacher/ExcelImportScreen';
import TeacherStudentListScreen from '../screens/teacher/TeacherStudentListScreen';
import AddStudentScreen from '../screens/teacher/AddStudentScreen';
import StudentDetailScreen from '../screens/teacher/StudentDetailScreen';

// Child Activity Flow
import ChildIntroScreen from '../screens/child/ChildIntroScreen';
import CharacterScreeningScreen from '../screens/child/CharacterScreeningScreen';
import SentenceScreeningScreen from '../screens/child/SentenceScreeningScreen';
import ScreeningCompleteScreen from '../screens/child/ScreeningCompleteScreen';

const Stack = createStackNavigator();

const RootNavigator = () => {
  const { user, role, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Initializing NeuroScreen...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: true }}>
        {!user ? (
          <>
            <Stack.Screen name="RoleSelect" component={RoleSelectScreen} options={{ title: 'Welcome to NeuroScreen' }} />
            <Stack.Screen name="ParentLogin" component={ParentLoginScreen} options={{ title: 'Parent Mobile Login' }} />
            <Stack.Screen name="OTPVerify" component={OTPVerifyScreen} options={{ title: 'Verify OTP Code' }} />
            <Stack.Screen name="TeacherLogin" component={TeacherLoginScreen} options={{ title: 'Teacher Sign In' }} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Forgot Password' }} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: 'Reset Password' }} />
          </>
        ) : role === 'PARENT' ? (
          <>
            <Stack.Screen name="ParentHome" component={ParentTabNavigator} options={{ headerShown: false }} />
            <Stack.Screen name="ParentConsent" component={ConsentScreen} options={{ title: 'Pre-Screening Consent' }} />
            <Stack.Screen name="AddChild" component={AddChildScreen} options={{ title: 'Add Child Profile' }} />
            <Stack.Screen name="ParentReport" component={ParentReportScreen} options={{ title: 'Observational Report' }} />
            <Stack.Screen name="ParentHistory" component={ParentHistoryScreen} options={{ title: 'Screening History' }} />

            {/* Child Friendly Screening Flow */}
            <Stack.Screen name="ChildIntro" component={ChildIntroScreen} options={{ title: 'Writing Activity', headerShown: false }} />
            <Stack.Screen name="CharacterScreening" component={CharacterScreeningScreen} options={{ title: 'Character Activity' }} />
            <Stack.Screen name="SentenceScreening" component={SentenceScreeningScreen} options={{ title: 'Sentence Activity' }} />
            <Stack.Screen name="ScreeningComplete" component={ScreeningCompleteScreen} options={{ headerShown: false }} />
          </>
        ) : (
          <>
            <Stack.Screen name="TeacherDashboard" component={TeacherTabNavigator} options={{ headerShown: false }} />
            <Stack.Screen name="ClassSetup" component={ClassSetupScreen} options={{ title: 'Class & School Setup' }} />
            <Stack.Screen name="ExcelImport" component={ExcelImportScreen} options={{ title: 'Excel Roster Import Engine' }} />
            <Stack.Screen name="TeacherStudentList" component={TeacherStudentListScreen} options={{ title: 'Class Roster Management' }} />
            <Stack.Screen name="AddStudent" component={AddStudentScreen} options={{ title: 'Add Student Record' }} />
            <Stack.Screen name="StudentDetail" component={StudentDetailScreen} options={{ title: 'Student Overview' }} />

            {/* Child Friendly Screening Flow launched by Teacher */}
            <Stack.Screen name="ChildIntro" component={ChildIntroScreen} options={{ title: 'Writing Activity', headerShown: false }} />
            <Stack.Screen name="CharacterScreening" component={CharacterScreeningScreen} options={{ title: 'Character Activity' }} />
            <Stack.Screen name="SentenceScreening" component={SentenceScreeningScreen} options={{ title: 'Sentence Activity' }} />
            <Stack.Screen name="ScreeningComplete" component={ScreeningCompleteScreen} options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});

export default RootNavigator;
