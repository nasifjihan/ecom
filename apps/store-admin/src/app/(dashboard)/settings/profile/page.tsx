"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Save,
  ImagePlus,
  ShieldCheck,
  KeyRound,
  RefreshCw,
  Loader2,
  Camera,
  User2,
  Phone,
  AtSign,
  X,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Label,
  Textarea,
  Avatar,
  AvatarFallback,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  Badge,
  Skeleton,
} from "@/components/ui";
import {
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
  useChangePasswordMutation,
} from "@/lib/features/settings/settings-api-slice";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(60),
  lastName: z.string().min(1, "Last name is required").max(60),
  displayName: z.string().min(1, "Display name is required").max(100),
  phone: z.string().max(30).optional().or(z.literal("")),
  bio: z.string().max(500).optional().or(z.literal("")),
  avatar: z.string().optional().or(z.literal("")),
});

const passwordSchema = z
  .object({
    oldPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Z]/, "Include 1 uppercase letter")
      .regex(/[a-z]/, "Include 1 lowercase letter")
      .regex(/[0-9]/, "Include 1 number")
      .regex(/[^A-Za-z0-9]/, "Include 1 special character"),
    confirmNewPassword: z.string().min(8, "At least 8 characters"),
  })
  .superRefine((v, ctx) => {
    if (v.newPassword !== v.confirmNewPassword) {
      ctx.addIssue({
        path: ["confirmNewPassword"],
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
      });
    }
  });

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function ProfileSettingsPage() {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const { data: me, isLoading: profileLoading } = useGetMyProfileQuery();
  const [updateProfile, updateLoading] = useUpdateMyProfileMutation();
  const [changePassword, passwordLoading] = useChangePasswordMutation();

  const profileMethods = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      displayName: "",
      phone: "",
      bio: "",
      avatar: "",
    },
  });
  const passwordMethods = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      oldPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });
  const { reset: resetProfile, control: profileControl } = profileMethods;
  const { reset: resetPassword, control: passwordControl } = passwordMethods;

  useEffect(() => {
    if (me) {
      resetProfile({
        firstName: me.firstName ?? "",
        lastName: me.lastName ?? "",
        displayName: me.displayName ?? `${me.firstName ?? ""} ${me.lastName ?? ""}`.trim(),
        phone: me.phone ?? "",
        bio: me.bio ?? "",
        avatar: me.avatar ?? "",
      });
      setAvatarPreview(me.avatar ?? null);
    }
  }, [me, resetProfile]);

  const onProfileSubmit = async (data: ProfileForm) => {
    try {
      await updateProfile({
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName,
        phone: data.phone || undefined,
        bio: data.bio || undefined,
        avatar: data.avatar || undefined,
      }).unwrap();
      toast.success("Profile updated.");
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to update profile.");
    }
  };

  const onPasswordSubmit = async (data: PasswordForm) => {
    try {
      await changePassword(data).unwrap();
      toast.success("Password changed.");
      resetPassword({ oldPassword: "", newPassword: "", confirmNewPassword: "" });
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to change password.");
    }
  };

  const handleAvatarFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      setAvatarPreview(result);
      profileMethods.setValue("avatar", result, { shouldDirty: true });
    };
    reader.readAsDataURL(file);
  };

  const clearAvatar = () => {
    setAvatarPreview(null);
    profileMethods.setValue("avatar", "", { shouldDirty: true });
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User2 className="h-5 w-5" /> My Profile
            </CardTitle>
            <CardDescription>
              Update your personal information, avatar, and preferences.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {profileLoading ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <Skeleton className="h-40 w-40 mx-auto rounded-full" />
                <div className="md:col-span-2 space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-1/2" />
                </div>
              </div>
            ) : (
              <FormProvider {...profileMethods}>
                <Form
                  id="profile-form"
                  onSubmit={profileMethods.handleSubmit(onProfileSubmit)}
                  className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr]"
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <Avatar className="h-40 w-40 ring-4 ring-slate-100 dark:ring-slate-800">
                        {avatarPreview ? (
                          <img
                            src={avatarPreview}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <AvatarFallback className="text-4xl font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {me?.displayName
                              ? me.displayName
                                  .split(/\s+/)
                                  .map((w) => w[0])
                                  .slice(0, 2)
                                  .join("")
                                  .toUpperCase()
                              : "U"}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <label className="absolute bottom-1 right-1 cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleAvatarFile(f);
                          }}
                        />
                        <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 transition-colors">
                          <Camera className="h-4 w-4" />
                        </span>
                      </label>
                      {avatarPreview && (
                        <button
                          type="button"
                          onClick={clearAvatar}
                          className="absolute top-1 right-1 h-7 w-7 rounded-full bg-white dark:bg-slate-800 text-slate-500 shadow-md hover:text-red-600 flex items-center justify-center"
                          title="Remove avatar"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="text-center space-y-1">
                      <div className="font-semibold">{me?.displayName}</div>
                      <div className="text-sm text-slate-500 flex items-center gap-1 justify-center">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                        {String(me?.role ?? "Admin")}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1 justify-center mt-2">
                        <AtSign className="h-3 w-3" />
                        {me?.email}
                      </div>
                    </div>
                    <div className="w-full">
                      <Label className="text-xs uppercase tracking-wider text-slate-500">
                        Role
                      </Label>
                      <div className="mt-1">
                        <Badge variant="outline" className="w-full justify-center">
                          <ShieldCheck className="h-3 w-3 mr-1.5" />
                          {String(me?.role ?? "STORE_ADMIN")}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        Assigned by the owner — contact support to change roles.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={profileControl}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={profileControl}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={profileControl}
                      name="displayName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Shown in the admin and on replies" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <AtSign className="h-3.5 w-3.5 text-slate-400" /> Email
                        </FormLabel>
                        <FormControl>
                          <Input value={me?.email ?? ""} disabled />
                        </FormControl>
                        <FormDescription>
                          Email is managed via your account security.
                        </FormDescription>
                      </FormItem>
                      <FormField
                        control={profileControl}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5 text-slate-400" /> Phone
                            </FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="+880..." />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={profileControl}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bio</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              rows={4}
                              placeholder="Short bio to display alongside your public replies..."
                            />
                          </FormControl>
                          <FormDescription>
                            Max 500 characters.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t">
                      <Button variant="outline" type="button" className="w-full sm:w-auto">
                        <ImagePlus className="h-4 w-4 mr-2" /> Upload New Photo
                      </Button>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => me && resetProfile({
                            firstName: me.firstName ?? "",
                            lastName: me.lastName ?? "",
                            displayName: me.displayName ?? "",
                            phone: me.phone ?? "",
                            bio: me.bio ?? "",
                            avatar: me.avatar ?? "",
                          })}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" /> Reset
                        </Button>
                        <Button type="submit" disabled={updateLoading} className="flex-1 sm:flex-none">
                          {updateLoading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  </div>
                </Form>
              </FormProvider>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        id="password"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> Change Password
            </CardTitle>
            <CardDescription>
              Use a strong password that includes a mix of letters, numbers, and symbols.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormProvider {...passwordMethods}>
              <Form
                id="password-form"
                onSubmit={passwordMethods.handleSubmit(onPasswordSubmit)}
                className="grid grid-cols-1 gap-4 md:grid-cols-3"
              >
                <FormField
                  control={passwordControl}
                  name="oldPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordControl}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} placeholder="••••••••" />
                      </FormControl>
                      <FormDescription>
                        Min 8 chars. Include upper, lower, number, and special.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordControl}
                  name="confirmNewPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} placeholder="••••••••" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="md:col-span-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t">
                  <div className="space-y-1 text-xs text-slate-500 max-w-md">
                    <p>
                      <ShieldCheck className="h-3 w-3 inline mr-1 text-emerald-500" />
                      We strongly recommend enabling two-factor authentication (2FA)
                      below for extra account protection.
                    </p>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled
                      title="Coming soon"
                    >
                      <ShieldCheck className="h-4 w-4 mr-2" /> Set Up 2FA
                      <Badge variant="secondary" className="ml-2 !h-5 !px-1.5 text-[10px]">
                        Soon
                      </Badge>
                    </Button>
                    <Button
                      type="submit"
                      disabled={passwordLoading}
                      className="flex-1 sm:flex-none"
                    >
                      {passwordLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <KeyRound className="h-4 w-4 mr-2" />
                      )}
                      Update Password
                    </Button>
                  </div>
                </div>
              </Form>
            </FormProvider>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
