import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const uploadProfileImage = async (userId: string, file: File) => {
    if (!userId || !file.type.startsWith('image/') || !file.size) {
        throw new Error('CinemaProfileInvalidImage');
    }

    // The legacy client reads the file and sends base64, not multipart/form-data.
    await window.ApiClient.uploadUserImage(userId, ImageType.Primary, file);
};

export const useProfileImageMutations = (userId: string) => {
    const queryClient = useQueryClient();
    const refreshUser = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['User', userId] }),
            queryClient.invalidateQueries({ queryKey: ['Users'] })
        ]);
    };

    return {
        upload: useMutation({
            mutationFn: (file: File) => uploadProfileImage(userId, file),
            onSuccess: refreshUser
        }),
        remove: useMutation({
            mutationFn: () => window.ApiClient.deleteUserImage(userId, ImageType.Primary),
            onSuccess: refreshUser
        })
    };
};
