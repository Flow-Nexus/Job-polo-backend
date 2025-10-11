//for AWS S3 Bucket Storage
export const uploadToNextcloud = async (filePath, file) => {
  const {
    NEXTCLOUD_BASE_URL: baseUrl,
    NEXTCLOUD_USERNAME: username,
    NEXTCLOUD_PASSWORD: password,
  } = process.env;

  if (!baseUrl || !username || !password) {
    throw new Error("Missing Nextcloud credentials in environment variables.");
  }

  // Clean up filePath: remove any leading slashes
  const cleanedPath = filePath.replace(/^\/+/, "");

  // Ensure folders exist before uploading (MKCOL)
  const folderSegments = cleanedPath.split("/");
  folderSegments.pop(); 
  let currentPath = "";

  for (const segment of folderSegments) {
    currentPath += `/${segment}`;
    const folderUrl = `${baseUrl}/remote.php/dav/files/${username}${currentPath}`;
    try {
      await axios.request({
        method: "MKCOL",
        url: folderUrl,
        auth: { username, password },
        validateStatus: (status) => status === 201 || status === 405,
      });
    } catch (err) {
      console.error(`❌ Error creating folder ${currentPath}:`, err?.response?.data || err.message);
    }
  }

  // Upload the file
  const uploadUrl = `${baseUrl}/remote.php/dav/files/${username}/${cleanedPath}`;
  try {
    await axios.put(uploadUrl, file.buffer, {
      auth: { username, password },
      headers: { "Content-Type": file.mimetype },
    });
    console.log(`✅ File uploaded: ${cleanedPath}`);
  } catch (error) {
    console.error("❌ File upload failed:", error?.response?.data || error.message);
    throw new Error("File upload failed");
  }

  // Create public share link
  let publicLink, previewLink;
  try {
    const shareResponse = await axios.post(
      `${baseUrl}/ocs/v1.php/apps/files_sharing/api/v1/shares`,
      new URLSearchParams({ path: `/${cleanedPath}`, shareType: "3" }),
      {
        auth: { username, password },
        headers: {
          "OCS-APIRequest": "true",
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    publicLink = shareResponse.data?.ocs?.data?.url;
    previewLink = `${publicLink}/preview`;

    console.log(`🔗 Public link created: ${publicLink}`);
  } catch (err) {
    console.error("❌ Share link error:", err?.response?.data || err.message);
    throw new Error("Public share link creation failed");
  }

  return { publicLink, previewLink };
};
