import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '../theme/colors';
import SidebarDrawer from '../components/SidebarDrawer';
import { useAuth } from '../context/AuthContext';

// Parent Screens
import ParentHomeScreen from '../screens/parent/ParentHomeScreen';
import AddChildScreen from '../screens/parent/AddChildScreen';
import ParentHistoryScreen from '../screens/parent/ParentHistoryScreen';
import ParentProfileScreen from '../screens/parent/ParentProfileScreen';

const Tab = createBottomTabNavigator();

const TabBarItem = ({ label, focused }) => (
  <View style={styles.itemContainer}>
    <Text style={[styles.itemText, focused && styles.itemTextActive]}>{label}</Text>
    {focused && <View style={styles.activeDot} />}
  </View>
);

const ParentTabNavigator = () => {
  const { logout } = useAuth();
  const [drawerVisible, setDrawerVisible] = useState(false);

  return (
    <>
      <SidebarDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        role="PARENT"
        onLogout={logout}
      />
      <Tab.Navigator
        screenOptions={{
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.card,
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 3,
          },
          headerTitleStyle: {
            fontSize: 17,
            fontWeight: '800',
            color: colors.textPrimary,
          },
          headerLeft: () => (
            <TouchableOpacity style={styles.menuBtn} onPress={() => setDrawerVisible(true)}>
              <Text style={styles.menuBtnText}>☰ Menu</Text>
            </TouchableOpacity>
          ),
          tabBarStyle: {
            height: 56,
            paddingBottom: 4,
            paddingTop: 4,
            backgroundColor: colors.card,
            borderTopWidth: 1,
            borderTopColor: colors.cardBorder,
          },
          tabBarShowLabel: false,
        }}
      >
        <Tab.Screen
          name="ParentHomeTab"
          component={ParentHomeScreen}
          options={{
            title: 'Parent Dashboard',
            tabBarIcon: ({ focused }) => <TabBarItem label="Home" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="AddChildTab"
          component={AddChildScreen}
          options={{
            title: 'Children & Consent',
            tabBarIcon: ({ focused }) => <TabBarItem label="Children" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="ParentHistoryTab"
          component={ParentHistoryScreen}
          options={{
            title: 'Screening History',
            tabBarIcon: ({ focused }) => <TabBarItem label="History" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="ParentProfileTab"
          component={ParentProfileScreen}
          options={{
            title: 'Parent Account',
            tabBarIcon: ({ focused }) => <TabBarItem label="Profile" focused={focused} />,
          }}
        />
      </Tab.Navigator>
    </>
  );
};

const styles = StyleSheet.create({
  menuBtn: {
    marginLeft: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  menuBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  itemContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  itemTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  activeDot: {
    width: 16,
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
    marginTop: 3,
  },
});

export default ParentTabNavigator;
