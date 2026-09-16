import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "./src/screens/LoginScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import JobListScreen from "./src/screens/JobListScreen";
import JobDetailScreen from "./src/screens/JobDetailScreen";
import CreateJobScreen from "./src/screens/CreateJobScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";
import ReportsScreen from "./src/screens/ReportsScreen";
import FilteredJobsScreen from "./src/screens/FilteredJobsScreen";
import ActivityScreen from "./src/screens/ActivityScreen";
import DailyReportScreen from "./src/screens/DailyReportScreen";
import ChangePasswordScreen from "./src/screens/ChangePasswordScreen";
import ForgotPasswordScreen from "./src/screens/ForgotPasswordScreen";
import { colors } from "./src/theme";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { fontWeight: "700", color: colors.textPrimary },
          headerTintColor: colors.primary,
          headerShadowVisible: true,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ForgotPassword"
          component={ForgotPasswordScreen}
          options={{ title: "Reset Password" }}
        />
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ title: "Dashboard" }}
        />
        <Stack.Screen
          name="JobList"
          component={JobListScreen}
          options={{ title: "My Jobs" }}
        />
        <Stack.Screen
          name="JobDetail"
          component={JobDetailScreen}
          options={{ title: "Job Details" }}
        />
        <Stack.Screen
          name="CreateJob"
          component={CreateJobScreen}
          options={{ title: "New Job" }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ title: "Notifications" }}
        />
        <Stack.Screen
          name="Reports"
          component={ReportsScreen}
          options={{ title: "Monthly Report" }}
        />
        <Stack.Screen
          name="FilteredJobs"
          component={FilteredJobsScreen}
          options={{ title: "Jobs" }}
        />
        <Stack.Screen
          name="Activity"
          component={ActivityScreen}
          options={{ title: "Recent Activity" }}
        />
        <Stack.Screen
          name="DailyReport"
          component={DailyReportScreen}
          options={{ title: "Daily Technician Report" }}
        />
        <Stack.Screen
          name="ChangePassword"
          component={ChangePasswordScreen}
          options={{ title: "Change Password" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}